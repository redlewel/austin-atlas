import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { latLonToWorld } from "@/lib/geo";
import type { TechCompany } from "@/lib/tech-pins";
import { disposeObject3D } from "@/lib/water-mesh";

export type BuildingFeature = {
  id: number;
  heightM: number;
  /** Outer ring first, then holes. Each ring is [x, z][] in world meters. */
  rings: [number, number][][];
};

export type AustinBuildingsData = {
  origin: { lat: number; lon: number };
  attribution: string;
  source: string;
  units: string;
  count: number;
  buildings: BuildingFeature[];
};

export type TechBuildingMatch = {
  company: TechCompany;
  building: BuildingFeature;
};

const BATCH_SIZE = 250;
const MATCH_RADIUS_M = 150;
const SHORT_BUILDING_M = 40;

function companyMatchRadius(company: TechCompany) {
  return company.matchRadiusM ?? MATCH_RADIUS_M;
}

function buildExtrudedGeometry(building: BuildingFeature) {
  const outer = building.rings[0];
  if (!outer || outer.length < 4) return null;

  const shape = new THREE.Shape();
  outer.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });

  for (let h = 1; h < building.rings.length; h++) {
    const holeRing = building.rings[h];
    if (!holeRing || holeRing.length < 4) continue;
    const hole = new THREE.Path();
    holeRing.forEach(([x, z], i) => {
      if (i === 0) hole.moveTo(x, -z);
      else hole.lineTo(x, -z);
    });
    shape.holes.push(hole);
  }

  try {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: building.heightM,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  } catch {
    return null;
  }
}

function heightColor(heightM: number) {
  const t = Math.min(1, Math.max(0, (heightM - 8) / 180));
  return new THREE.Color().setHSL(
    0.58 - t * 0.12,
    0.12 + t * 0.18,
    0.42 + t * 0.18,
  );
}

function applyVertexColors(
  geometry: THREE.BufferGeometry,
  heightM: number,
) {
  const color = heightColor(heightM);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function flushBatch(
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  material: THREE.MeshStandardMaterial,
) {
  if (!geometries.length) return;
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  geometries.length = 0;
  if (merged) group.add(new THREE.Mesh(merged, material.clone()));
}

function pointInRing(x: number, z: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect =
      zi > z !== zj > z &&
      x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function centroid(ring: [number, number][]) {
  let x = 0;
  let z = 0;
  for (const [px, pz] of ring) {
    x += px;
    z += pz;
  }
  const n = ring.length || 1;
  return { x: x / n, z: z / n };
}

/**
 * Match each company to the best CoA footprint (prefer containing tall massing,
 * else tallest nearby when the pin lands on a short podium).
 */
export function matchTechBuildings(
  data: AustinBuildingsData,
  companies: TechCompany[],
): TechBuildingMatch[] {
  const matches: TechBuildingMatch[] = [];
  const usedIds = new Set<number>();

  for (const company of companies) {
    const { x, z } = latLonToWorld(company.lat, company.lon);
    const radius = companyMatchRadius(company);
    type Cand = {
      building: BuildingFeature;
      dist: number;
      inside: boolean;
    };
    const cands: Cand[] = [];

    for (const building of data.buildings) {
      if (usedIds.has(building.id)) continue;
      const outer = building.rings[0];
      if (!outer) continue;
      const c = centroid(outer);
      const dist = Math.hypot(c.x - x, c.z - z);
      const inside = pointInRing(x, z, outer);
      if (inside || dist <= radius) {
        cands.push({ building, dist, inside });
      }
    }

    if (!cands.length) continue;

    const containing = cands.filter((c) => c.inside);
    let pick: Cand | null = null;

    if (containing.length) {
      const tallestInside = containing.reduce((a, b) =>
        a.building.heightM >= b.building.heightM ? a : b,
      );
      if (tallestInside.building.heightM >= SHORT_BUILDING_M) {
        pick = tallestInside;
      } else {
        const tallerNearby = cands
          .filter(
            (c) =>
              c.building.heightM > tallestInside.building.heightM * 1.5 &&
              c.dist <= radius,
          )
          .sort((a, b) => b.building.heightM - a.building.heightM)[0];
        pick = tallerNearby ?? tallestInside;
      }
    } else if (company.matchRadiusM && company.matchRadiusM > MATCH_RADIUS_M) {
      // Campus sites (e.g. Tesla): prefer large footprints near the pin.
      const footprint = (b: BuildingFeature) => {
        const ring = b.rings[0];
        let area = 0;
        for (let i = 0; i < ring.length - 1; i++) {
          const [x1, z1] = ring[i];
          const [x2, z2] = ring[i + 1];
          area += x1 * z2 - x2 * z1;
        }
        return Math.abs(area) / 2;
      };
      pick = cands.reduce((a, b) => {
        const scoreA = footprint(a.building) / (1 + a.dist);
        const scoreB = footprint(b.building) / (1 + b.dist);
        return scoreA >= scoreB ? a : b;
      });
    } else {
      // Prefer nearer massing over a distant taller neighbor.
      pick = cands.reduce((a, b) => {
        const scoreA = a.building.heightM / (1 + a.dist * 0.08);
        const scoreB = b.building.heightM / (1 + b.dist * 0.08);
        return scoreA >= scoreB ? a : b;
      });
    }

    if (!pick) continue;
    usedIds.add(pick.building.id);
    matches.push({ company, building: pick.building });
  }

  return matches;
}

export function buildTechBuildingMeshes(matches: TechBuildingMatch[]) {
  const group = new THREE.Group();
  group.name = "tech-buildings";
  const hoverMeshes: THREE.Mesh[] = [];

  for (const { company, building } of matches) {
    const geometry = buildExtrudedGeometry(building);
    if (!geometry) continue;

    const material = new THREE.MeshStandardMaterial({
      color: company.color,
      roughness: 0.45,
      metalness: 0.2,
      emissive: company.color,
      emissiveIntensity: 0.22,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // Slight lift so brand massing wins z-fighting against grey LOD1.
    mesh.position.y = 0.4;
    mesh.userData.label = company.name;
    mesh.userData.address = company.address;
    mesh.userData.company = company.name;
    mesh.userData.companyId = company.id;
    mesh.userData.buildingId = building.id;
    mesh.userData.baseEmissive = 0.22;
    // Focus target: centroid at mid-height.
    const c = centroid(building.rings[0]);
    mesh.userData.focus = {
      x: c.x,
      y: building.heightM * 0.45,
      z: c.z,
    };
    group.add(mesh);
    hoverMeshes.push(mesh);
  }

  return { group, hoverMeshes };
}

/**
 * Extrude CoA footprints into merged LOD1 meshes, yielding between batches
 * so the main thread stays responsive.
 */
export async function buildBuildingMeshes(
  data: AustinBuildingsData,
  options?: {
    signal?: { cancelled: boolean };
    excludeIds?: Set<number>;
  },
) {
  const group = new THREE.Group();
  group.name = "austin-buildings";
  const signal = options?.signal;
  const excludeIds = options?.excludeIds;

  const material = new THREE.MeshStandardMaterial({
    color: "#9ca3af",
    roughness: 0.85,
    metalness: 0.08,
    vertexColors: true,
    flatShading: true,
  });

  const geometries: THREE.BufferGeometry[] = [];

  for (let i = 0; i < data.buildings.length; i++) {
    if (signal?.cancelled) {
      for (const g of geometries) g.dispose();
      geometries.length = 0;
      disposeObject3D(group);
      material.dispose();
      return null;
    }

    const building = data.buildings[i];
    if (excludeIds?.has(building.id)) continue;

    const geometry = buildExtrudedGeometry(building);
    if (geometry) {
      applyVertexColors(geometry, building.heightM);
      geometries.push(geometry);
    }

    if (geometries.length >= BATCH_SIZE) {
      flushBatch(group, geometries, material);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  }

  flushBatch(group, geometries, material);
  material.dispose();
  group.userData.attribution = data.attribution;
  return group;
}

export function disposeBuildingMeshes(object: THREE.Object3D) {
  disposeObject3D(object);
}
