export type LatLon = { lat: number; lon: number };

export type GeoBounds = {
  north: number;
  west: number;
  south: number;
  east: number;
};

/** Scene origin — downtown Austin. +X east, +Y up, −Z north. */
export const AUSTIN_ORIGIN: LatLon = { lat: 30.2672, lon: -97.7431 };

/** Approximate metro extent — must match water data bbox. */
export const AUSTIN_BOUNDS: GeoBounds = {
  north: 30.35,
  west: -97.8,
  south: 30.2,
  east: -97.65,
};

function metersPerDegree(latDeg: number) {
  const lat = (latDeg * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat),
    lon:
      111412.84 * Math.cos(lat) -
      93.5 * Math.cos(3 * lat) +
      0.118 * Math.cos(5 * lat),
  };
}

const meters = metersPerDegree(AUSTIN_ORIGIN.lat);

export function latLonToWorld(lat: number, lon: number) {
  return {
    x: (lon - AUSTIN_ORIGIN.lon) * meters.lon,
    y: 0,
    z: (AUSTIN_ORIGIN.lat - lat) * meters.lat,
  };
}

export function worldToLatLon(x: number, z: number): LatLon {
  return {
    lon: AUSTIN_ORIGIN.lon + x / meters.lon,
    lat: AUSTIN_ORIGIN.lat - z / meters.lat,
  };
}

export function planeSizeFromBounds(bounds: GeoBounds) {
  return {
    widthM: Math.abs(bounds.east - bounds.west) * meters.lon,
    heightM: Math.abs(bounds.north - bounds.south) * meters.lat,
  };
}

/** Place a plane so its edges match the bounds corners, with slight padding. */
export function groundPlacementFromBounds(bounds: GeoBounds, paddingM = 600) {
  const nw = latLonToWorld(bounds.north, bounds.west);
  const se = latLonToWorld(bounds.south, bounds.east);

  return {
    widthM: se.x - nw.x + paddingM * 2,
    heightM: se.z - nw.z + paddingM * 2,
    centerX: (nw.x + se.x) / 2,
    centerZ: (nw.z + se.z) / 2,
  };
}

export const GROUND_PLANE = groundPlacementFromBounds(AUSTIN_BOUNDS);
