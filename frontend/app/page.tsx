"use client";

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Home() {
  return (
    <main className="relative h-full w-full">
      <Scene />
      <div className="pointer-events-none absolute top-5 left-5 rounded-lg bg-black/45 px-3 py-2 text-xs text-white backdrop-blur-sm">
        <p className="font-medium">Austin coordinate frame</p>
        <p className="text-white/75">Origin: 30.2672°N, 97.7431°W · +X east, −Z north</p>
        <p className="text-white/75">Pins: Google, Meta, Indeed, Oracle</p>
      </div>
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-2 text-sm text-white">
        Drag to orbit · scroll to zoom · right-drag to pan
      </p>
    </main>
  );
}
