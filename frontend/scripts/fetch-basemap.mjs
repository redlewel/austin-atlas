/**
 * Fetch City of Austin parks + major streets for the atlas basemap.
 * Writes: public/data/austin-basemap.json (world meters, +X east, −Z north)
 */
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT = join(ROOT, "public/data/austin-basemap.json");

const ORIGIN = { lat: 30.2672, lon: -97.7431 };
/** Match AUSTIN_BOUNDS in lib/geo.ts */
const BBOX = { west: -97.88, south: 30.2, east: -97.6, north: 30.44 };
const MAX_RING_POINTS = 40;
/** ROAD_CLASS: 1 freeway, 4 arterial, 5 major collector — skip frontage/local. */
const MAJOR_ROAD_CLASSES = new Set([1, 4, 5]);

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

function decimate(ring, maxPoints) {
  if (ring.length <= maxPoints) return ring;
  const step = (ring.length - 1) / (maxPoints - 1);
  const out = [];
  for (let i = 0; i < maxPoints - 1; i++) out.push(ring[Math.round(i * step)]);
  out.push(ring[0]);
  return out;
}

function convertRing(lonLatRing) {
  if (!lonLatRing || lonLatRing.length < 4) return null;
  const world = lonLatRing.map(([lon, lat]) => latLonToWorld(lat, lon));
  const first = world[0];
  const last = world[world.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.5) {
    world.push([...first]);
  }
  return decimate(world, MAX_RING_POINTS);
}

async function queryAll(urlBase, extraParams = {}) {
  const features = [];
  let offset = 0;
  const page = 1000;
  const geometry = `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`;
  while (true) {
    const params = new URLSearchParams({
      where: "1=1",
      geometry,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
      resultRecordCount: String(page),
      resultOffset: String(offset),
      ...extraParams,
    });
    const res = await fetch(`${urlBase}?${params}`);
    if (!res.ok) throw new Error(`${urlBase} HTTP ${res.status}`);
    const data = await res.json();
    const batch = data.features || [];
    features.push(...batch);
    process.stdout.write(`  offset ${offset}: +${batch.length}\n`);
    if (batch.length < page) break;
    offset += page;
    if (offset > 80000) break;
  }
  return features;
}

function parksFromFeatures(features) {
  const parks = [];
  for (const f of features) {
    const props = f.properties || {};
    const geom = f.geometry;
    if (!geom) continue;
    const name = props.LOCATION_NAME || null;
    const polys =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];
    for (const poly of polys) {
      const rings = [];
      for (const ring of poly) {
        const converted = convertRing(ring);
        if (converted) rings.push(converted);
      }
      if (rings.length) parks.push({ name, rings });
    }
  }
  return parks;
}

function roadsFromFeatures(features) {
  const roads = [];
  for (const f of features) {
    const props = f.properties || {};
    const rc = props.ROAD_CLASS;
    if (!MAJOR_ROAD_CLASSES.has(rc)) continue;
    const geom = f.geometry;
    if (!geom) continue;
    const lines =
      geom.type === "LineString"
        ? [geom.coordinates]
        : geom.type === "MultiLineString"
          ? geom.coordinates
          : [];
    for (const line of lines) {
      if (!line || line.length < 2) continue;
      // Decimate long polylines.
      const step = Math.max(1, Math.floor(line.length / 48));
      const points = [];
      for (let i = 0; i < line.length; i += step) {
        const [lon, lat] = line[i];
        points.push(latLonToWorld(lat, lon));
      }
      const last = line[line.length - 1];
      const lastW = latLonToWorld(last[1], last[0]);
      const prev = points[points.length - 1];
      if (!prev || Math.hypot(prev[0] - lastW[0], prev[1] - lastW[1]) > 1) {
        points.push(lastW);
      }
      if (points.length >= 2) {
        roads.push({
          name: props.FULL_STREET_NAME || null,
          roadClass: rc,
          points,
        });
      }
    }
  }
  return roads;
}

const PARKS_URL =
  "https://maps.austintexas.gov/arcgis/rest/services/Shared/Infrastructure_2/MapServer/0/query";
const STREETS_URL =
  "https://maps.austintexas.gov/gis/rest/Shared/Property/MapServer/1/query";

console.log("Fetching parks…");
const parkFeatures = await queryAll(PARKS_URL, {
  outFields: "OBJECTID,LOCATION_NAME,PARK_TYPE",
});
console.log("Fetching streets…");
const streetFeatures = await queryAll(STREETS_URL, {
  outFields: "OBJECTID,FULL_STREET_NAME,ROAD_CLASS,SPEED_LIMIT",
});

const parks = parksFromFeatures(parkFeatures);
const roads = roadsFromFeatures(streetFeatures);

const payload = {
  origin: ORIGIN,
  bbox: BBOX,
  attribution:
    "City of Austin — Parks (Infrastructure_2) & Streets (Property). Building density pads derived from CoA footprints.",
  parks,
  roads,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(payload));
console.log(
  `Wrote ${parks.length} parks, ${roads.length} major road segments → ${OUTPUT}`,
);
console.log(`File size: ${(statSync(OUTPUT).size / 1e6).toFixed(2)} MB`);
