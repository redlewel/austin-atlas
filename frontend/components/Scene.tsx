"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GROUND_PLANE, latLonToWorld } from "@/lib/geo";
import {
  buildWaterMeshes,
  disposeObject3D,
  type AustinWaterData,
} from "@/lib/water-mesh";
import { TECH_COMPANIES, type TechCompany } from "@/lib/tech-pins";
import { buildCapitolDome, disposeCapitolDome } from "@/lib/capitol-mesh";
import {
  buildBuildingMeshes,
  buildTechBuildingMeshes,
  disposeBuildingMeshes,
  matchTechBuildings,
  type AustinBuildingsData,
} from "@/lib/buildings-mesh";
import {
  buildBasemapMeshes,
  disposeBasemapMeshes,
  type AustinBasemapData,
} from "@/lib/basemap-mesh";

type BuildingTooltip = {
  name: string;
  address?: string;
  x: number;
  y: number;
};

type FocusTarget = {
  x: number;
  y: number;
  z: number;
};

type Props = {
  focusCompanyId: string | null;
  onFocused?: (companyId: string) => void;
};

function collectLabeledMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.label) {
      meshes.push(child);
    }
  });
  return meshes;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function Scene({ focusCompanyId, onFocused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<BuildingTooltip | null>(null);
  const focusMapRef = useRef<Map<string, FocusTarget>>(new Map());
  const flyRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    anim: {
      startCam: THREE.Vector3;
      startTarget: THREE.Vector3;
      endCam: THREE.Vector3;
      endTarget: THREE.Vector3;
      t0: number;
      dur: number;
      companyId: string;
    } | null;
  } | null>(null);
  const meshByIdRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const onFocusedRef = useRef(onFocused);
  onFocusedRef.current = onFocused;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let frameId = 0;
    let waterGroup: THREE.Group | null = null;
    let buildingsGroup: THREE.Group | null = null;
    let techBuildingsGroup: THREE.Group | null = null;
    let basemapGroup: THREE.Group | null = null;
    const cancelSignal = { cancelled: false };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87CEEB");
    scene.fog = new THREE.Fog(
      "#87CEEB",
      GROUND_PLANE.heightM * 0.55,
      GROUND_PLANE.heightM * 3.2,
    );

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
      new THREE.MeshStandardMaterial({ color: "#86efac" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GROUND_PLANE.centerX, 0, GROUND_PLANE.centerZ);
    scene.add(ground);

    const gridSize = Math.max(GROUND_PLANE.widthM, GROUND_PLANE.heightM);
    const grid = new THREE.GridHelper(gridSize, 24, "#4ade80", "#86efac");
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

    const capitolDome = buildCapitolDome();
    scene.add(capitolDome);

    const hoverTargets: THREE.Mesh[] = [
      ...collectLabeledMeshes(capitolDome),
    ];
    let hovered: THREE.Mesh | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const clearHover = () => {
      if (hovered && hovered !== selectedMeshRef.current) {
        const mat = hovered.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity != null) {
          mat.emissiveIntensity =
            (hovered.userData.baseEmissive as number | undefined) ?? 0.22;
        }
        hovered = null;
      } else if (hovered === selectedMeshRef.current) {
        hovered = null;
      }
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxDistance = GROUND_PLANE.heightM * 2.2;
    controls.minDistance = 120;
    controls.update();

    flyRef.current = { camera, controls, anim: null };

    // Seed focus targets from company lat/lon until meshes load.
    for (const company of TECH_COMPANIES) {
      const { x, z } = latLonToWorld(company.lat, company.lon);
      focusMapRef.current.set(company.id, { x, y: 80, z });
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hoverTargets, false);
      const hit = hits[0]?.object;

      if (hit instanceof THREE.Mesh && hit.userData.label) {
        if (hovered !== hit) {
          clearHover();
          hovered = hit;
          if (hit !== selectedMeshRef.current) {
            const mat = hit.material as THREE.MeshStandardMaterial;
            if (mat.emissiveIntensity != null) {
              mat.emissiveIntensity = 0.55;
            }
          }
        }
        renderer.domElement.style.cursor = "pointer";
        setTooltip({
          name: hit.userData.label as string,
          address: hit.userData.address as string | undefined,
          x: event.clientX - rect.left + 12,
          y: event.clientY - rect.top + 12,
        });
      } else {
        clearHover();
        renderer.domElement.style.cursor = "";
        setTooltip(null);
      }
    };

    const onPointerLeave = () => {
      clearHover();
      renderer.domElement.style.cursor = "";
      setTooltip(null);
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const render = () => {
      const fly = flyRef.current;
      if (fly?.anim) {
        const { anim } = fly;
        const u = Math.min(1, (performance.now() - anim.t0) / anim.dur);
        const e = easeInOutCubic(u);
        fly.camera.position.lerpVectors(anim.startCam, anim.endCam, e);
        fly.controls.target.lerpVectors(anim.startTarget, anim.endTarget, e);
        fly.controls.update();
        if (u >= 1) {
          onFocusedRef.current?.(anim.companyId);
          fly.anim = null;
        }
      } else {
        controls.update();
      }

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

    fetch("/data/austin-buildings.json")
      .then((res) => {
        if (!res.ok) throw new Error(`buildings HTTP ${res.status}`);
        return res.json();
      })
      .then(async (data: AustinBuildingsData) => {
        if (cancelSignal.cancelled) return;

        const matches = matchTechBuildings(data, TECH_COMPANIES);
        const { group: techGroup, hoverMeshes } =
          buildTechBuildingMeshes(matches);
        if (cancelSignal.cancelled) {
          disposeBuildingMeshes(techGroup);
          return;
        }
        techBuildingsGroup = techGroup;
        scene.add(techGroup);
        hoverTargets.push(...hoverMeshes);

        for (const mesh of hoverMeshes) {
          const id = mesh.userData.companyId as string | undefined;
          const focus = mesh.userData.focus as FocusTarget | undefined;
          if (id && focus) focusMapRef.current.set(id, focus);
          if (id) meshByIdRef.current.set(id, mesh);
        }

        const excludeIds = new Set(matches.map((m) => m.building.id));
        const built = await buildBuildingMeshes(data, {
          signal: cancelSignal,
          excludeIds,
        });
        if (!built || cancelSignal.cancelled) {
          if (built) disposeBuildingMeshes(built);
          return;
        }
        buildingsGroup = built;
        scene.add(buildingsGroup);

        // Parks / roads / urban pads — after buildings so we have footprints.
        try {
          const basemapRes = await fetch("/data/austin-basemap.json");
          if (basemapRes.ok) {
            const basemap = (await basemapRes.json()) as AustinBasemapData;
            if (!cancelSignal.cancelled) {
              basemapGroup = buildBasemapMeshes(basemap);
              scene.add(basemapGroup);
            }
          }
        } catch (err) {
          console.error("Failed to load basemap data:", err);
        }
      })
      .catch((err) => console.error("Failed to load building data:", err));

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelled = true;
      cancelSignal.cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      flyRef.current = null;
      if (waterGroup) disposeObject3D(waterGroup);
      if (buildingsGroup) disposeBuildingMeshes(buildingsGroup);
      if (techBuildingsGroup) disposeBuildingMeshes(techBuildingsGroup);
      if (basemapGroup) disposeBasemapMeshes(basemapGroup);
      disposeCapitolDome(capitolDome);
      ground.geometry.dispose();
      (ground.material as THREE.MeshStandardMaterial).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      setTooltip(null);
    };
  }, []);

  useEffect(() => {
    if (!focusCompanyId) return;
    const fly = flyRef.current;
    const focus =
      focusMapRef.current.get(focusCompanyId) ??
      (focusCompanyId === "google"
        ? focusMapRef.current.get("google-500")
        : undefined) ??
      (focusCompanyId === "amazon"
        ? focusMapRef.current.get("amazon-alterra")
        : undefined) ??
      (focusCompanyId === "meta"
        ? focusMapRef.current.get("meta-shoal")
        : undefined);
    if (!fly || !focus) return;

    const mesh =
      meshByIdRef.current.get(focusCompanyId) ??
      (focusCompanyId === "google"
        ? meshByIdRef.current.get("google-500")
        : undefined) ??
      (focusCompanyId === "amazon"
        ? meshByIdRef.current.get("amazon-alterra")
        : undefined) ??
      (focusCompanyId === "meta"
        ? meshByIdRef.current.get("meta-shoal")
        : undefined) ??
      null;

    // Reset previous selection, then grow focused building by a fixed 10%.
    const prev = selectedMeshRef.current;
    if (prev && prev !== mesh) {
      prev.scale.set(1, 1, 1);
      const mat = prev.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity =
        (prev.userData.baseEmissive as number | undefined) ?? 0.22;
    }
    selectedMeshRef.current = mesh;
    if (mesh) {
      mesh.scale.set(1.1, 1.1, 1.1);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.42;
    }

    // Aim camera at the building (look-at target = mid-height).
    const endTarget = new THREE.Vector3(focus.x, Math.max(focus.y, 40), focus.z);
    const offset = new THREE.Vector3(140, 110, 170);
    const endCam = endTarget.clone().add(offset);

    fly.anim = {
      startCam: fly.camera.position.clone(),
      startTarget: fly.controls.target.clone(),
      endCam,
      endTarget,
      t0: performance.now(),
      dur: 850,
      companyId: focusCompanyId,
    };
  }, [focusCompanyId]);

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
          className="pointer-events-none absolute z-10 max-w-xs rounded-md bg-black/80 px-2.5 py-1.5 text-sm text-white shadow-lg backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <p className="font-medium">{tooltip.name}</p>
          {tooltip.address ? (
            <p className="text-xs text-white/70">{tooltip.address}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type { TechCompany };
