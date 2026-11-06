"use client";

import { Thumbnail } from "@remotion/player";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ConceptScene, getCompiled } from "@/motion/ConceptScene";
import { SAMPLE_SCENES } from "@/lib/samples";
import { FPS, W } from "@/motion/timeline";
import type { Scene } from "@/lib/schema";

function Grid() {
  const params = useSearchParams();
  const key = params.get("s") ?? "API";
  const H = Number(params.get("h") ?? 1920);
  let scene: Scene | undefined = SAMPLE_SCENES[key];
  if (typeof window !== "undefined" && key === "custom") {
    try {
      scene = JSON.parse(window.localStorage.getItem("lab.scene") ?? "null") ?? undefined;
    } catch {}
  }
  if (!scene) return <div>no scene</div>;
  const c = getCompiled(scene);
  const times = (params.get("t") ?? "").split(",").filter(Boolean).map(Number);
  const frames = times.length
    ? times.map((t) => Math.round(t * FPS))
    : [10, c.d0 + 20, c.d0 + 50, c.d0 + 80, c.d0 + 110, c.d0 + 140, c.termAt - 4, c.termAt + 40];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, background: "#222" }}>
      {frames.map((fr) => (
        <div key={fr} style={{ width: 270 }}>
          <Thumbnail
            component={ConceptScene}
            compositionWidth={W}
            compositionHeight={H}
            frameToDisplay={Math.min(fr, c.total - 1)}
            durationInFrames={c.total}
            fps={FPS}
            inputProps={{ scene, height: H, showCaptions: true }}
            style={{ width: 270, height: (270 * H) / W }}
          />
          <div style={{ color: "#fff", font: "12px monospace" }}>
            f{fr} ({(fr / FPS).toFixed(1)}s) / {c.total}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Lab() {
  return (
    <Suspense>
      <Grid />
    </Suspense>
  );
}
