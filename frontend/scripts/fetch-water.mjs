#!/usr/bin/env node
/**
 * Fetch Austin water features from OSM and write geo-local JSON.
 * Run: npm run fetch-water
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Downtown Austin — scene origin. +X east, +Y up, −Z north. */
const ORIGIN = { lat: 30.2672, lon: -97.7431 };

/** Shared scene extent — ground plane and water query use the same box. */
export const SCENE_BOUNDS = {
  south: 30.2,
  west: -97.8,
  north: 30.35,
  east: -97.65,
};

const MAX_POLYGON_DIM_M = 22_000;

const OVERPASS = `[out:json][timeout:90];
(
  way["natural"="water"](${SCENE_BOUNDS.south},${SCENE_BOUNDS.west},${SCENE_BOUNDS.north},${SCENE_BOUNDS.east});
  relation["natural"="water"](${SCENE_BOUNDS.south},${SCENE_BOUNDS.west},${SCENE_BOUNDS.north},${SCENE_BOUNDS.east});
  way["waterway"~"river|canal"](${SCENE_BOUNDS.south},${SCENE_BOUNDS.west},${SCENE_BOUNDS.north},${SCENE_BOUNDS.east});
);
out geom;`;

function metersPerDegree(latDeg) {
  const lat = (latDeg * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat),
    lon:
      111412.84 * Math.cos(lat) -
      93.5 * Math.cos(3 * lat) +
      0.118 * Math.cos(5 * lat),
  };
}

const meters = metersPerDegree(ORIGIN.lat);

function toLocal(lat, lon) {
  return [
    (lon - ORIGIN.lon) * meters.lon,
    (ORIGIN.lat - lat) * meters.lat,
  ];
}

const SCENE_NW = toLocal(SCENE_BOUNDS.north, SCENE_BOUNDS.west);
const SCENE_SE = toLocal(SCENE_BOUNDS.south, SCENE_BOUNDS.east);
const SCENE_MIN_X = SCENE_NW[0];
const SCENE_MAX_X = SCENE_SE[0];
const SCENE_MIN_Z = SCENE_NW[1];
const SCENE_MAX_Z = SCENE_SE[1];

function ringArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[i + 1];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

function ringBounds(ring) {
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

const ENDPOINT_TOL = 15;

function dist2d(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function isClosedGeo(geometry) {
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  const dx = (first.lon - last.lon) * meters.lon;
  const dz = (first.lat - last.lat) * meters.lat;
  return Math.hypot(dx, dz) < ENDPOINT_TOL;
}

function ringEndpointsClose(ring, tol = ENDPOINT_TOL) {
  if (ring.length < 3) return false;
  return dist2d(ring[0], ring[ring.length - 1]) <= tol;
}

function isClosedRing(ring) {
  return ringEndpointsClose(ring, 0.5);
}

function normalizeClosedRing(ring) {
  let r = dedupeRing(ring);
  if (r.length < 3) return null;
  if (!ringEndpointsClose(r)) return null;
  // Keep an explicit closing vertex so downstream code knows the ring is closed.
  if (dist2d(r[0], r[r.length - 1]) > 0.5) r = [...r, r[0]];
  return r;
}

function maxEdgeLength(ring) {
  let max = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    max = Math.max(max, dist2d(ring[i], ring[i + 1]));
  }
  return max;
}

function dedupeRing(ring) {
  if (ring.length === 0) return ring;
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [px, pz] = out[out.length - 1];
    if (Math.hypot(x - px, z - pz) > 0.5) out.push(ring[i]);
  }
  return out.length >= 3 ? out : [];
}

function ringFromGeometry(geometry) {
  return dedupeRing(geometry.map(({ lat, lon }) => toLocal(lat, lon)));
}

function isNonFillWater(tags = {}) {
  return (
    tags.water === "river" ||
    tags.waterway === "river" ||
    tags.water === "stream"
  );
}

function maxEdgeAllowed(area, pointCount) {
  if (pointCount <= 8) return 100;
  if (pointCount <= 20) return 150;
  if (area > 2_000_000) return 350;
  return Math.min(250, Math.max(130, 0.15 * Math.sqrt(area)));
}

function ringCompactness(ring) {
  let perimeter = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[i + 1];
    perimeter += Math.hypot(x2 - x1, z2 - z1);
  }
  const area = ringArea(ring);
  return { area, perimeter, compactness: area / (perimeter * perimeter) };
}

function isValidRing(ring) {
  if (ring.length < 4) return false;
  if (!isClosedRing(ring)) return false;

  const closed = ring;
  const bounds = ringBounds(closed);
  if (bounds.width > MAX_POLYGON_DIM_M || bounds.height > MAX_POLYGON_DIM_M) {
    return false;
  }
  if (!bboxIntersectsScene(bounds)) return false;

  const { area, compactness } = ringCompactness(ring);
  if (area < 2000) return false;

  const maxEdge = maxEdgeLength(ring);
  if (maxEdge > maxEdgeAllowed(area, ring.length)) return false;

  if (area < 500_000 && !centroidInsideScene(ring)) return false;

  const aspect =
    Math.max(bounds.width, bounds.height) /
    Math.max(1, Math.min(bounds.width, bounds.height));
  const minDim = Math.min(bounds.width, bounds.height);

  if (aspect > 4 && minDim < 500) return false;
  if (compactness < 0.0015 && aspect > 3) return false;

  const insideThreshold = area > 1_000_000 ? 0.45 : area > 100_000 ? 0.65 : 0.9;
  return mostlyInsideScene(ring, insideThreshold);
}

/** Join open OSM way segments into closed outer rings. */
function stitchOuterRings(members) {
  const segments = members
    .filter((m) => m.role === "outer" && m.geometry?.length >= 2)
    .map((m) => ringFromGeometry(m.geometry));

  const used = new Array(segments.length).fill(false);
  const rings = [];

  function appendSegment(ring, seg, reverse) {
    const pts = reverse ? [...seg].reverse() : seg;
    if (dist2d(ring[ring.length - 1], pts[0]) > ENDPOINT_TOL) return null;
    return [...ring, ...pts.slice(1)];
  }

  function prependSegment(ring, seg, reverse) {
    const pts = reverse ? [...seg].reverse() : seg;
    if (dist2d(ring[0], pts[pts.length - 1]) > ENDPOINT_TOL) return null;
    return [...pts.slice(0, -1), ...ring];
  }

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;

    let ring = [...segments[i]];
    used[i] = true;
    let changed = true;

    while (changed) {
      changed = false;
      if (ringEndpointsClose(ring)) break;

      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        for (const reverse of [false, true]) {
          const next = appendSegment(ring, segments[j], reverse);
          if (next) {
            ring = next;
            used[j] = true;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }

      if (changed || ringEndpointsClose(ring)) continue;

      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        for (const reverse of [false, true]) {
          const next = prependSegment(ring, segments[j], reverse);
          if (next) {
            ring = next;
            used[j] = true;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    const closed = normalizeClosedRing(ring);
    if (closed) rings.push(closed);
  }

  return rings;
}

function mostlyInsideScene(ring, threshold = 0.9) {
  let inside = 0;
  for (const [x, z] of ring) {
    if (
      x >= SCENE_MIN_X &&
      x <= SCENE_MAX_X &&
      z >= SCENE_MIN_Z &&
      z <= SCENE_MAX_Z
    ) {
      inside++;
    }
  }
  return inside / ring.length >= threshold;
}

function bboxIntersectsScene({ minX, maxX, minZ, maxZ }) {
  return !(
    maxX < SCENE_MIN_X ||
    minX > SCENE_MAX_X ||
    maxZ < SCENE_MIN_Z ||
    minZ > SCENE_MAX_Z
  );
}

function centroidInsideScene(ring) {
  const n = ring.length;
  if (n <= 0) return false;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += ring[i][0];
    cz += ring[i][1];
  }
  cx /= n;
  cz /= n;
  return (
    cx >= SCENE_MIN_X &&
    cx <= SCENE_MAX_X &&
    cz >= SCENE_MIN_Z &&
    cz <= SCENE_MAX_Z
  );
}

function clipLineToScene(points) {
  return points.filter(
    ([x, z]) =>
      x >= SCENE_MIN_X &&
      x <= SCENE_MAX_X &&
      z >= SCENE_MIN_Z &&
      z <= SCENE_MAX_Z,
  );
}

function polygonsFromWay(el) {
  if (isNonFillWater(el.tags)) return [];
  if (!isClosedGeo(el.geometry)) return [];
  const ring = normalizeClosedRing(ringFromGeometry(el.geometry));
  if (!ring || !isValidRing(ring)) return [];
  return [{ name: el.tags?.name ?? null, rings: [ring] }];
}

/** Stitch relation outer ways into closed rings before building polygons. */
function polygonsFromRelation(el) {
  if (isNonFillWater(el.tags)) return [];

  const name = el.tags?.name ?? null;
  return stitchOuterRings(el.members)
    .filter(isValidRing)
    .map((ring) => ({ name, rings: [ring] }));
}

async function loadOsm() {
  const cachePath = join(__dirname, "../.cache/austin-water-osm.json");
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(OVERPASS)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass request failed: ${res.status}`);
  }

  const osm = await res.json();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(osm));
  return osm;
}

const osm = existsSync("/tmp/austin-water-osm.json")
  ? JSON.parse(readFileSync("/tmp/austin-water-osm.json", "utf8"))
  : await loadOsm();

const polygons = [];
const lines = [];

for (const el of osm.elements) {
  if (el.type === "way" && el.tags?.natural === "water" && el.geometry) {
    polygons.push(...polygonsFromWay(el));
    continue;
  }

  if (el.type === "relation" && el.tags?.natural === "water" && el.members) {
    polygons.push(...polygonsFromRelation(el));
    continue;
  }

  if (
    el.type === "way" &&
    ["river", "canal"].includes(el.tags?.waterway ?? "") &&
    el.geometry?.length >= 2
  ) {
    const points = clipLineToScene(
      el.geometry.map(({ lat, lon }) => toLocal(lat, lon)),
    );
    if (points.length >= 2) {
      lines.push({
        name: el.tags?.name ?? null,
        kind: el.tags.waterway,
        points,
      });
    }
  }
}

const payload = {
  origin: ORIGIN,
  bbox: SCENE_BOUNDS,
  attribution: "© OpenStreetMap contributors (ODbL)",
  polygons,
  lines,
};

const outDir = join(__dirname, "../public/data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "austin-water.json"), JSON.stringify(payload));

console.log(
  `Wrote ${polygons.length} water polygons, ${lines.length} waterways`,
);
