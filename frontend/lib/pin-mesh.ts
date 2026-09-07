import * as THREE from "three";
import { latLonToWorld } from "@/lib/geo";
import type { TechCompany } from "@/lib/tech-pins";

export const BUILDING_BASE_Y = 0.5;

/** Optional debug markers — scene prefers colored CoA footprints instead. */
export function buildTechPinMeshes(companies: TechCompany[]) {
  const group = new THREE.Group();
  group.name = "tech-pins";

  for (const company of companies) {
    const { x, z } = latLonToWorld(company.lat, company.lon);
    const material = new THREE.MeshStandardMaterial({
      color: company.color,
      roughness: 0.45,
      metalness: 0.1,
      emissive: company.color,
      emissiveIntensity: 0.15,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(18, 90, 18), material);
    box.position.set(x, BUILDING_BASE_Y + 45, z);
    box.userData.label = company.name;
    box.userData.address = company.address;
    group.add(box);
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
