import * as THREE from "three";
import { latLonToWorld } from "@/lib/geo";
import type { TechPin } from "@/lib/tech-pins";

function createMarkerMesh(color: string) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.1,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), material);
  box.position.y = 20;
  return box;
}

export function buildTechPinMeshes(pins: TechPin[]) {
  const group = new THREE.Group();
  group.name = "tech-pins";

  for (const pin of pins) {
    const { x, z } = latLonToWorld(pin.lat, pin.lon);
    const marker = createMarkerMesh(pin.color);
    marker.position.set(x, 0, z);
    marker.userData.name = pin.name;
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
