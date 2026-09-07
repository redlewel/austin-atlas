/**
 * Convert City of Austin building footprints GeoJSON → world-space JSON
 * for Three.js extrusion (+X east, +Y up, −Z north; meters).
 *
 * Reads:  public/data/buildings/austin-coa-footprints.geojson
 * Writes: public/data/austin-buildings.json
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const INPUT = join(
  ROOT,
  "public/data/buildings/austin-coa-footprints.geojson",
);
const OUTPUT = join(ROOT, "public/data/austin-buildings.json");

const ORIGIN = { lat: 30.2672, lon: -97.7431 };
const FT_TO_M = 0.3048;
/** Skip sheds / noise; keep recognizable massing (~3+ stories). */
const MIN_HEIGHT_M = 10;
/** Cap absurd outliers while keeping Independent (~210 m). */
const MAX_HEIGHT_M = 400;
/** Drop rings denser than this after decimation. */
const MAX_RING_POINTS = 32;

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

function latLonToWorld(lat, lon) {
  return [
    (lon - ORIGIN.lon) * meters.lon,
    (ORIGIN.lat - lat) * meters.lat,
  ];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[i + 1];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

function decimateRing(ring, maxPoints) {
  if (ring.length <= maxPoints) return ring;
  const step = (ring.length - 1) / (maxPoints - 1);
  const out = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    out.push(ring[Math.round(i * step)]);
  }
  out.push(ring[0]);
  return out;
}

function convertRing(lonLatRing) {
  if (!lonLatRing || lonLatRing.length < 4) return null;
  const world = lonLatRing.map(([lon, lat]) => latLonToWorld(lat, lon));
  // Ensure closed.
  const first = world[0];
  const last = world[world.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.5) {
    world.push([...first]);
  }
  const slim = decimateRing(world, MAX_RING_POINTS);
  if (slim.length < 4) return null;
  if (ringArea(slim) < 25) return null; // < ~5×5 m
  return slim;
}

function convertPolygon(coords) {
  const rings = [];
  for (const ring of coords) {
    const converted = convertRing(ring);
    if (converted) rings.push(converted);
  }
  return rings.length ? rings : null;
}

const raw = JSON.parse(readFileSync(INPUT, "utf8"));
const buildings = [];
let skipped = 0;

for (const feature of raw.features ?? []) {
  const props = feature.properties ?? {};
  const geom = feature.geometry;
  if (!geom) {
    skipped++;
    continue;
  }

  const heightFt = props.MAX_HEIGHT;
  if (heightFt == null || !Number.isFinite(heightFt) || heightFt <= 0) {
    skipped++;
    continue;
  }

  let heightM = heightFt * FT_TO_M;
  if (heightM < MIN_HEIGHT_M) {
    skipped++;
    continue;
  }
  heightM = Math.min(heightM, MAX_HEIGHT_M);

  let rings = null;
  if (geom.type === "Polygon") {
    rings = convertPolygon(geom.coordinates);
  } else if (geom.type === "MultiPolygon") {
    // One building record per part keeps extrusions simple.
    for (const poly of geom.coordinates) {
      const partRings = convertPolygon(poly);
      if (!partRings) continue;
      buildings.push({
        id: props.OBJECTID,
        heightM: Math.round(heightM * 100) / 100,
        rings: partRings,
      });
    }
    continue;
  }

  if (!rings) {
    skipped++;
    continue;
  }

  buildings.push({
    id: props.OBJECTID,
    heightM: Math.round(heightM * 100) / 100,
    rings,
  });
}

const payload = {
  origin: ORIGIN,
  attribution:
    raw.attribution ??
    "City of Austin Watershed Protection Department — Building Footprints 2023",
  source:
    raw.source ??
    "https://maps.austintexas.gov/gis/rest/Shared/PlanimetricsSurvey_1/MapServer/0",
  units: "meters",
  count: buildings.length,
  buildings,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(payload));
console.log(
  `Wrote ${buildings.length} buildings (${skipped} skipped) → ${OUTPUT}`,
);
console.log(`File size: ${(statSync(OUTPUT).size / 1e6).toFixed(2)} MB`);
