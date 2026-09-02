"use client";

import { useEffect, useRef } from "react";
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

export default function Scene() {
  const containerRef = useRef<HTMLDivElement>(null);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxDistance = GROUND_PLANE.heightM * 2;
    controls.minDistance = 200;
    controls.update();

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
      controls.dispose();
      if (waterGroup) disposeObject3D(waterGroup);
      disposePinGroup(pinGroup);
      ground.geometry.dispose();
      (ground.material as THREE.MeshStandardMaterial).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Austin geo scene"
    />
  );
}
