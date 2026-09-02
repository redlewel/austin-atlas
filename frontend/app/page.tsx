"use client";

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Home() {
  return (
    <main className="relative h-full w-full">
      <Scene />
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-2 text-sm text-white">
        Drag to orbit · scroll to zoom · right-drag to pan
      </p>
    </main>
  );
}
