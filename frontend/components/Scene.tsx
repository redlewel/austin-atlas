"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GROUND_PLANE } from "@/lib/geo";
import {
  buildWaterMeshes,
  disposeObject3D,
  type AustinWaterData,
} from "@/lib/water-mesh";
import { DOWNTOWN_TECH_PINS } from "@/lib/tech-pins";
import { buildTechPinMeshes, disposePinGroup } from "@/lib/pin-mesh";
import { buildCapitolDome, disposeCapitolDome } from "@/lib/capitol-mesh";

type BuildingTooltip = {
  name: string;
  x: number;
  y: number;
};

function collectBuildingMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.label) {
      meshes.push(child);
    }
  });
  return meshes;
}

export default function Scene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<BuildingTooltip | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let frameId = 0;
    let waterGroup: THREE.Group | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87CEEB");
    scene.fog = new THREE.Fog("#87CEEB", GROUND_PLANE.heightM * 0.5, GROUND_PLANE.heightM * 3);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      10,
      GROUND_PLANE.heightM * 4,
    );
    camera.position.set(0, 6500, 4500);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_PLANE.widthM, GROUND_PLANE.heightM),
      new THREE.MeshStandardMaterial({ color: "#4ade80" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GROUND_PLANE.centerX, 0, GROUND_PLANE.centerZ);
    scene.add(ground);

    const gridSize = Math.max(GROUND_PLANE.widthM, GROUND_PLANE.heightM);
    const grid = new THREE.GridHelper(gridSize, 24, "#166534", "#22c55e");
    grid.scale.set(
      GROUND_PLANE.widthM / gridSize,
      1,
      GROUND_PLANE.heightM / gridSize,
    );
    grid.position.set(GROUND_PLANE.centerX, 0.5, GROUND_PLANE.centerZ);
    scene.add(grid);

    scene.add(new THREE.AmbientLight("#ffffff", 0.65));
    const sun = new THREE.DirectionalLight("#ffffff", 0.9);
    sun.position.set(4000, 8000, 2000);
    scene.add(sun);

    const pinGroup = buildTechPinMeshes(DOWNTOWN_TECH_PINS);
    scene.add(pinGroup);

    const capitolDome = buildCapitolDome();
    scene.add(capitolDome);

    const hoverTargets = [
      ...collectBuildingMeshes(pinGroup),
      ...collectBuildingMeshes(capitolDome),
    ];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxDistance = GROUND_PLANE.heightM * 2;
    controls.minDistance = 200;
    controls.update();

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hoverTargets, false);
      const hit = hits[0]?.object;

      if (hit?.userData.label) {
        renderer.domElement.style.cursor = "pointer";
        setTooltip({
          name: hit.userData.label as string,
          x: event.clientX - rect.left + 12,
          y: event.clientY - rect.top + 12,
        });
      } else {
        renderer.domElement.style.cursor = "";
        setTooltip(null);
      }
    };

    const onPointerLeave = () => {
      renderer.domElement.style.cursor = "";
      setTooltip(null);
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    fetch("/data/austin-water.json")
      .then((res) => res.json())
      .then((data: AustinWaterData) => {
        if (cancelled) return;
        waterGroup = buildWaterMeshes(data);
        scene.add(waterGroup);
      })
      .catch((err) => console.error("Failed to load water data:", err));

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      if (waterGroup) disposeObject3D(waterGroup);
      disposePinGroup(pinGroup);
      disposeCapitolDome(capitolDome);
      ground.geometry.dispose();
      (ground.material as THREE.MeshStandardMaterial).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      setTooltip(null);
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Austin geo scene"
      />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-black/75 px-2.5 py-1.5 text-sm text-white shadow-lg backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.name}
        </div>
      ) : null}
    </div>
  );
}
