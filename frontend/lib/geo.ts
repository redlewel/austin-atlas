/** WGS84 bounds for the Austin base map (top-left / bottom-right). */
export const AUSTIN_BOUNDS = {
  north: dmsToDeg(30, 30, 17.26),
  west: -dmsToDeg(97, 49, 31.78),
  south: dmsToDeg(30, 7, 43.92),
  east: -dmsToDeg(97, 38, 36.68),
} as const;

export type LatLon = { lat: number; lon: number };

export function dmsToDeg(degrees: number, minutes: number, seconds: number) {
  return degrees + minutes / 60 + seconds / 3600;
}

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

const originLat = (AUSTIN_BOUNDS.north + AUSTIN_BOUNDS.south) / 2;
const originLon = (AUSTIN_BOUNDS.east + AUSTIN_BOUNDS.west) / 2;
const meters = metersPerDegree(originLat);

/** Native pixels of the base-map screenshot. Do not stretch this. */
export const MAP_IMAGE = { width: 1024, height: 934 } as const;

/** East–west meters implied by the given longitudes. */
export const AUSTIN_WIDTH_M =
  Math.abs(AUSTIN_BOUNDS.east - AUSTIN_BOUNDS.west) * meters.lon;

/**
 * Ground plane size matching the screenshot aspect (1024×934).
 * Height follows the image so the texture is not stretched; the given
 * latitudes describe a taller box than this photo, so they are not used
 * for plane height.
 */
export const MAP_PLANE_WIDTH_M = AUSTIN_WIDTH_M;
export const MAP_PLANE_HEIGHT_M =
  AUSTIN_WIDTH_M * (MAP_IMAGE.height / MAP_IMAGE.width);

/**
 * Local world meters: +X east, +Y up, −Z north, origin at the bounds center.
 */
export function latLonToWorld(lat: number, lon: number): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: (lon - originLon) * meters.lon,
    y: 0,
    z: (originLat - lat) * meters.lat,
  };
}

export function worldToLatLon(x: number, z: number): LatLon {
  return {
    lon: originLon + x / meters.lon,
    lat: originLat - z / meters.lat,
  };
}
