import * as THREE from "three";
import { latLonToWorld } from "@/lib/geo";
import type { TechPin } from "@/lib/tech-pins";

export const BUILDING_BASE_Y = 0.5;
const BOX_SIZE_M = 40 * 5;

function createMarkerMesh(color: string, label: string) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.1,
  });

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_SIZE_M, BOX_SIZE_M, BOX_SIZE_M),
    material,
  );
  box.position.y = BUILDING_BASE_Y + BOX_SIZE_M / 2;
  box.userData.label = label;
  return box;
}

export function buildTechPinMeshes(pins: TechPin[]) {
  const group = new THREE.Group();
  group.name = "tech-pins";

  for (const pin of pins) {
    const { x, z } = latLonToWorld(pin.lat, pin.lon);
    const marker = createMarkerMesh(pin.color, pin.name);
    marker.position.set(x, marker.position.y, z);
    marker.userData.address = pin.address;
    group.add(marker);
  }

  return group;
}

export function disposePinGroup(object: THREE.Object3D) {
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
