import * as THREE from "three";

export type WaterPolygon = {
  name: string | null;
  rings: [number, number][][];
};

export type WaterLine = {
  name: string | null;
  kind: string;
  points: [number, number][];
};

export type AustinWaterData = {
  origin: { lat: number; lon: number };
  bbox: { north: number; south: number; east: number; west: number };
  attribution: string;
  polygons: WaterPolygon[];
  lines: WaterLine[];
};

function ringBounds(ring: [number, number][]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, height: maxZ - minZ };
}

function dist2d(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function isClosedRing(ring: [number, number][]) {
  if (ring.length < 4) return false;
  return dist2d(ring[0], ring[ring.length - 1]) < 0.5;
}

function maxEdgeLength(ring: [number, number][]) {
  let max = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    max = Math.max(max, dist2d(ring[i], ring[i + 1]));
  }
  return max;
}

function maxEdgeAllowed(area: number, pointCount: number) {
  if (pointCount <= 8) return 100;
  if (pointCount <= 20) return 150;
  if (area > 2_000_000) return 350;
  return Math.min(250, Math.max(130, 0.15 * Math.sqrt(area)));
}

function ringArea(ring: [number, number][]) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[i + 1];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

function isRenderablePolygon(ring: [number, number][]) {
  if (ring.length < 4 || !isClosedRing(ring)) return false;

  const area = ringArea(ring);
  const maxEdge = maxEdgeLength(ring);
  if (maxEdge > maxEdgeAllowed(area, ring.length)) return false;

  const { width, height } = ringBounds(ring);
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  const minDim = Math.min(width, height);
  if (aspect > 4 && minDim < 500) return false;
  return true;
}

function buildPolygonMesh(
  poly: WaterPolygon,
  material: THREE.MeshStandardMaterial,
) {
  const outer = poly.rings[0];
  if (!outer || !isRenderablePolygon(outer)) return null;

  const shape = new THREE.Shape();
  outer.forEach(([x, z], i) => {
    // Shape Y becomes world −Z after rotateX(−π/2), so pass −z to match geo coords.
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  // Ring includes an explicit closing vertex — no extra chord needed.

  try {
    const geometry = new THREE.ShapeGeometry(shape, 8);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.position.y = 1;
    mesh.userData.name = poly.name;
    return mesh;
  } catch {
    return null;
  }
}

export function buildWaterMeshes(data: AustinWaterData) {
  const group = new THREE.Group();
  group.name = "austin-water";

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  for (const poly of data.polygons) {
    const mesh = buildPolygonMesh(poly, waterMaterial);
    if (mesh) group.add(mesh);
  }

  const riverMaterial = new THREE.LineBasicMaterial({
    color: "#0284c7",
    linewidth: 1, // WebGL caps at 1px; major rivers also appear as lake polygons.
  });

  for (const line of data.lines) {
    if (line.kind !== "river" && line.kind !== "canal") continue;
    if (line.points.length < 2) continue;

    const positions = new Float32Array(line.points.length * 3);
    line.points.forEach(([x, z], i) => {
      positions[i * 3] = x;
      positions[i * 3 + 1] = 2;
      positions[i * 3 + 2] = z;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const riverLine = new THREE.Line(geometry, riverMaterial.clone());
    riverLine.userData.name = line.name;
    group.add(riverLine);
  }

  return group;
}

export function disposeObject3D(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
