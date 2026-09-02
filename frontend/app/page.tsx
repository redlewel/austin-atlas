"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GroundMode } from "@/components/Scene";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Home() {
  const [groundMode, setGroundMode] = useState<GroundMode>("map");

  return (
    <main className="relative h-full w-full">
      <Scene groundMode={groundMode} />
      <div className="absolute top-5 left-1/2 z-10 flex -translate-x-1/2 rounded-full bg-black/45 p-1 text-sm text-white backdrop-blur-sm">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 transition ${
            groundMode === "map" ? "bg-white text-black" : "text-white/80"
          }`}
          onClick={() => setGroundMode("map")}
        >
          Austin map
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 transition ${
            groundMode === "plane" ? "bg-white text-black" : "text-white/80"
          }`}
          onClick={() => setGroundMode("plane")}
        >
          Green plane
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-2 text-sm text-white">
        Drag to orbit · scroll to zoom · right-drag to pan
      </p>
    </main>
  );
}
