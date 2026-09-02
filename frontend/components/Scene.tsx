"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MAP_PLANE_HEIGHT_M, MAP_PLANE_WIDTH_M } from "@/lib/geo";

export type GroundMode = "map" | "plane";

type SceneProps = {
  groundMode: GroundMode;
};

export default function Scene({ groundMode }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapMeshRef = useRef<THREE.Mesh | null>(null);
  const greenMeshRef = useRef<THREE.Mesh | null>(null);
  const groundModeRef = useRef(groundMode);
  groundModeRef.current = groundMode;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87CEEB");

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      10,
      250_000,
    );
    camera.position.set(0, MAP_PLANE_HEIGHT_M * 0.9, MAP_PLANE_HEIGHT_M * 0.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(
      MAP_PLANE_WIDTH_M,
      MAP_PLANE_HEIGHT_M,
    );

    const greenMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: "#22c55e" }),
    );
    greenMesh.rotation.x = -Math.PI / 2;
    greenMesh.visible = groundModeRef.current === "plane";
    scene.add(greenMesh);
    greenMeshRef.current = greenMesh;

    const mapMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    );
    mapMesh.rotation.x = -Math.PI / 2;
    mapMesh.position.y = 0.5;
    mapMesh.visible = groundModeRef.current === "map";
    scene.add(mapMesh);
    mapMeshRef.current = mapMesh;

    const loader = new THREE.TextureLoader();
    const mapTexture = loader.load("/austin-base-map.png", (texture) => {
      if (cancelled) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      const material = mapMesh.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.needsUpdate = true;
    });

    const ambient = new THREE.AmbientLight("#ffffff", 0.7);
    const sun = new THREE.DirectionalLight("#ffffff", 1.05);
    sun.position.set(
      MAP_PLANE_WIDTH_M * 0.4,
      MAP_PLANE_HEIGHT_M,
      MAP_PLANE_WIDTH_M * 0.2,
    );
    scene.add(ambient, sun);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxDistance = MAP_PLANE_HEIGHT_M * 3;
    controls.minDistance = 200;
    controls.update();

    let frameId = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

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
      mapTexture.dispose();
      geometry.dispose();
      (greenMesh.material as THREE.MeshStandardMaterial).dispose();
      (mapMesh.material as THREE.MeshBasicMaterial).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      mapMeshRef.current = null;
      greenMeshRef.current = null;
    };
  }, []);

  useEffect(() => {
    const showMap = groundMode === "map";
    if (mapMeshRef.current) mapMeshRef.current.visible = showMap;
    if (greenMeshRef.current) greenMeshRef.current.visible = !showMap;
  }, [groundMode]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="3D scene"
    />
  );
}
