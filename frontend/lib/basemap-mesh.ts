import * as THREE from "three";
import { disposeObject3D } from "@/lib/water-mesh";

export type BasemapPark = {
  name: string | null;
  rings: [number, number][][];
};

export type BasemapRoad = {
  name: string | null;
  roadClass: number;
  points: [number, number][];
};

export type AustinBasemapData = {
  origin: { lat: number; lon: number };
  attribution: string;
  parks: BasemapPark[];
  roads: BasemapRoad[];
};

const PARK_Y = 0.35;
const ROAD_Y = 0.55;

function buildShapeMesh(
  rings: [number, number][][],
  material: THREE.MeshStandardMaterial,
  y: number,
) {
  const outer = rings[0];
  if (!outer || outer.length < 4) return null;

  const shape = new THREE.Shape();
  outer.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });

  for (let h = 1; h < rings.length; h++) {
    const holeRing = rings[h];
    if (!holeRing || holeRing.length < 4) continue;
    const hole = new THREE.Path();
    holeRing.forEach(([x, z], i) => {
      if (i === 0) hole.moveTo(x, -z);
      else hole.lineTo(x, -z);
    });
    shape.holes.push(hole);
  }

  try {
    const geometry = new THREE.ShapeGeometry(shape, 2);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.position.y = y;
    return mesh;
  } catch {
    return null;
  }
}

function buildParkMeshes(parks: BasemapPark[]) {
  const group = new THREE.Group();
  group.name = "parks";
  const material = new THREE.MeshStandardMaterial({
    color: "#4ade80",
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  });

  for (const park of parks) {
    const mesh = buildShapeMesh(park.rings, material, PARK_Y);
    if (!mesh) continue;
    mesh.userData.name = park.name;
    group.add(mesh);
  }

  material.dispose();
  return group;
}

function buildRoadLines(roads: BasemapRoad[]) {
  const group = new THREE.Group();
  group.name = "major-roads";

  const freewayMat = new THREE.LineBasicMaterial({ color: "#57534e" });
  const arterialMat = new THREE.LineBasicMaterial({ color: "#78716c" });

  for (const road of roads) {
    if (road.points.length < 2) continue;
    const positions = new Float32Array(road.points.length * 3);
    road.points.forEach(([x, z], i) => {
      positions[i * 3] = x;
      positions[i * 3 + 1] = ROAD_Y;
      positions[i * 3 + 2] = z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = road.roadClass <= 1 ? freewayMat : arterialMat;
    const line = new THREE.Line(geometry, mat.clone());
    line.userData.name = road.name;
    group.add(line);
  }

  freewayMat.dispose();
  arterialMat.dispose();
  return group;
}

/**
 * Soft green ground stays as the scene plane; this layer adds CoA parks
 * and major road centerlines.
 */
export function buildBasemapMeshes(basemap: AustinBasemapData) {
  const group = new THREE.Group();
  group.name = "austin-basemap";

  group.add(buildParkMeshes(basemap.parks));
  group.add(buildRoadLines(basemap.roads));
  group.userData.attribution = basemap.attribution;
  return group;
}

export function disposeBasemapMeshes(object: THREE.Object3D) {
  disposeObject3D(object);
}
