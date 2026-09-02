import * as THREE from "three";
import { latLonToWorld } from "@/lib/geo";
import { BUILDING_BASE_Y } from "@/lib/pin-mesh";

/** Texas State Capitol — Congress Ave & 11th St (Wikipedia / TCEQ). */
export const TEXAS_STATE_CAPITOL = {
  name: "Texas State Capitol",
  lat: 30.27472,
  lon: -97.74056,
};

const DOME_RADIUS_M = 45 * 5;

function createCapitolDome(label: string) {
  const material = new THREE.MeshStandardMaterial({
    color: "#c9957a",
    roughness: 0.55,
    metalness: 0.05,
  });

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(
      DOME_RADIUS_M,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    material,
  );
  dome.position.y = BUILDING_BASE_Y + DOME_RADIUS_M;
  dome.userData.label = label;
  return dome;
}

export function buildCapitolDome() {
  const group = new THREE.Group();
  group.name = "texas-state-capitol";

  const { x, z } = latLonToWorld(
    TEXAS_STATE_CAPITOL.lat,
    TEXAS_STATE_CAPITOL.lon,
  );
  const dome = createCapitolDome(TEXAS_STATE_CAPITOL.name);
  dome.position.x = x;
  dome.position.z = z;
  group.add(dome);

  return group;
}

export function disposeCapitolDome(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
