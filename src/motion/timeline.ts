import type { Actor, Scene } from "@/lib/schema";

/* ------------------------------------------------------------------ */
/*  Layout constants (composition units, 1080 wide)                   */
/* ------------------------------------------------------------------ */

export const FPS = 30;
export const W = 1080;
export const BASE_H = 1920;

/** Stage area where actors live (in the 1080×1920 base frame). */
export const STAGE = { x0: 60, y0: 360, w: 960, h: 860 };
export const HOOK_Y = 790;
export const CAPTION_Y = 1350;
export const TERM_Y = 1330;
export const DEF_TOP = 1500;

const HOOK_SECONDS = 2.0;

export const CARD_PX = { s: 190, m: 250, l: 320 } as const;
export const EMOJI_PX = { s: 120, m: 170, l: 230 } as const;
export const TEXT_PX = { s: 68, m: 92, l: 124 } as const;
export const NUMBER_PX = { s: 96, m: 140, l: 190 } as const;
export const BAR_PX = { s: 90, m: 120, l: 150 } as const;
export const PILL_FONT = 56;

export type SfxKind =
  | "hook"
  | "pop"
  | "whoosh"
  | "tick"
  | "out"
  | "draw"
  | "boop"
  | "shimmer"
  | "buzz"
  | "flip"
  | "count"
  | "rise"
  | "ding"
  | "sparkle"
  | "impact"
  | "swish";

export interface Cue {
  f: number;
  kind: SfxKind;
  dur?: number; // seconds
}

export interface ActorTrack {
  actor: Actor;
  /** resolved base position in stage units */
  bx: number;
  by: number;
  enterF: number;
  enterStyle: string;
  spawnFrom: string | null;
  exitF: number | null;
  moves: { f0: number; f1: number; x: number; y: number }[];
  pulses: number[];
  shakes: number[];
  glows: { f0: number; f1: number }[];
  dims: { f: number; on: boolean }[];
  swaps: { f: number; emoji: string; label: string }[];
  counts: { f0: number; f1: number; v: number }[];
  grows: { f0: number; f1: number; v: number }[];
  marks: { f: number; kind: "check" | "cross" }[];
}

export interface LinkTrack {
  id: string;
  a: string;
  b: string;
  style: string;
  label: string;
  f0: number;
  f1: number;
  exitF: number | null;
}

export interface SendTrack {
  a: string;
  b: string;
  style: string;
  text: string;
  emoji: string;
  f0: number;
  f1: number;
}

export interface Compiled {
  scene: Scene;
  d0: number; // frame where the diagram phase starts
  termAt: number; // frame of the term slam
  total: number; // total frames
  tracks: Map<string, ActorTrack>;
  order: string[]; // render order (zones first)
  links: LinkTrack[];
  sends: SendTrack[];
  bursts: { a: string; f0: number }[];
  captions: { f0: number; f1: number; text: string }[];
  cues: Cue[];
}

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

export function textWidth(s: string, font: number): number {
  let w = 0;
  for (const ch of Array.from(s)) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 32) w += 0.3;
    else if (c >= 0x1100 && c <= 0x11ff) w += 0.95;
    else if (c >= 0xac00 && c <= 0xd7a3) w += 0.95;
    else if (c >= 0x3000 && c <= 0x9fff) w += 0.95;
    else if (c >= 0x1f000) w += 1.1;
    else if (c >= 0x41 && c <= 0x5a) w += 0.64;
    else if (c >= 0x30 && c <= 0x39) w += 0.58;
    else if (c >= 0x61 && c <= 0x7a) w += 0.52;
    else w += 0.6;
  }
  return w * font;
}

export const sx = (x: number) => STAGE.x0 + (x / 100) * STAGE.w;
export const sy = (y: number) => STAGE.y0 + (y / 100) * STAGE.h;
const ux = (px: number) => ((px - STAGE.x0) / STAGE.w) * 100;
const uy = (py: number) => ((py - STAGE.y0) / STAGE.h) * 100;

/** Half extents (px) of an actor's main body, used for link trimming and lanes. */
export function bodyExtent(a: Actor, label?: string): { hw: number; hh: number } {
  const text = label ?? a.label;
  switch (a.type) {
    case "card":
    case "circle": {
      const s = CARD_PX[a.size];
      return { hw: s / 2 + 4, hh: s / 2 + 4 };
    }
    case "emoji": {
      const s = EMOJI_PX[a.size];
      return { hw: s * 0.55, hh: s * 0.55 };
    }
    case "pill": {
      const w = textWidth(text || " ", PILL_FONT) + (a.emoji ? 70 : 0) + 96;
      return { hw: w / 2, hh: 50 };
    }
    case "text": {
      const f = TEXT_PX[a.size];
      return { hw: Math.min(470, textWidth(text || " ", f) / 2 + 10), hh: f * 0.62 };
    }
    case "number": {
      const f = NUMBER_PX[a.size];
      return { hw: textWidth(`${Math.round(a.value)}${text}`, f) / 2 + 10, hh: f * 0.55 };
    }
    case "bar": {
      const w = BAR_PX[a.size];
      return { hw: w / 2, hh: 40 };
    }
    case "zone":
      return { hw: ((a.w || 60) / 100) * STAGE.w * 0.5, hh: ((a.h || 50) / 100) * STAGE.h * 0.5 };
  }
}

/** Full footprint (px) incl. labels below, used for overlap resolution. */
function footprint(a: Actor): { hw: number; top: number; bottom: number } {
  const { hw, hh } = bodyExtent(a);
  const labelH = a.label && (a.type === "card" || a.type === "circle" || a.type === "emoji") ? 74 : 0;
  const labelW = labelH ? Math.min(160, textWidth(a.label, 42) / 2 + 6) : 0;
  if (a.type === "bar") {
    const maxH = ((a.h || 45) / 100) * STAGE.h;
    return { hw: Math.max(hw, labelW), top: maxH + 60, bottom: 60 };
  }
  return { hw: Math.max(hw, labelW), top: hh, bottom: hh + labelH };
}

function resolveOverlaps(actors: Actor[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const items = actors
    .filter((a) => a.type !== "zone")
    .map((a) => ({ a, fp: footprint(a), x: sx(a.x), y: sy(a.y) }));
  const margin = 22;
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const p = items[i];
        const q = items[j];
        const ox = p.fp.hw + q.fp.hw + margin - Math.abs(p.x - q.x);
        // vertical overlap considering asymmetric top/bottom extents
        const pTop = p.y - p.fp.top;
        const pBot = p.y + p.fp.bottom;
        const qTop = q.y - q.fp.top;
        const qBot = q.y + q.fp.bottom;
        const oy = Math.min(pBot, qBot) - Math.max(pTop, qTop) + margin;
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) {
            const dir = p.x <= q.x ? -1 : 1;
            p.x += (dir * ox) / 2;
            q.x -= (dir * ox) / 2;
          } else {
            const dir = p.y <= q.y ? -1 : 1;
            p.y += (dir * oy) / 2;
            q.y -= (dir * oy) / 2;
          }
        }
      }
    }
    // keep inside the stage (x strictly, y with a little bleed)
    for (const it of items) {
      const minX = STAGE.x0 + it.fp.hw - 10;
      const maxX = STAGE.x0 + STAGE.w - it.fp.hw + 10;
      it.x = minX > maxX ? STAGE.x0 + STAGE.w / 2 : Math.min(maxX, Math.max(minX, it.x));
      const minY = STAGE.y0 + it.fp.top - 40;
      const maxY = STAGE.y0 + STAGE.h - it.fp.bottom + 40;
      it.y = minY > maxY ? STAGE.y0 + STAGE.h / 2 : Math.min(maxY, Math.max(minY, it.y));
    }
    if (!moved) break;
  }
  for (const it of items) pos.set(it.a.id, { x: ux(it.x), y: uy(it.y) });
  for (const a of actors) if (a.type === "zone") pos.set(a.id, { x: a.x, y: a.y });
  return pos;
}

/* ------------------------------------------------------------------ */
/*  Compile a scene into frame-based tracks                            */
/* ------------------------------------------------------------------ */

const f = (sec: number) => Math.round(sec * FPS);

export function compile(scene: Scene): Compiled {
  const hasHook = scene.hook.trim().length > 0;
  const d0 = f(hasHook ? HOOK_SECONDS : 0.4);
  const at = (t: number) => d0 + f(t);

  const resolved = resolveOverlaps(scene.actors);
  const tracks = new Map<string, ActorTrack>();
  const enteredByBeat = new Set(scene.beats.filter((b) => b.do === "enter").map((b) => b.a));

  let stagger = 0;
  for (const a of scene.actors) {
    const p = resolved.get(a.id) ?? { x: a.x, y: a.y };
    const initiallyVisible = !a.hidden && !enteredByBeat.has(a.id);
    tracks.set(a.id, {
      actor: a,
      bx: p.x,
      by: p.y,
      enterF: initiallyVisible ? d0 + (a.type === "zone" ? 0 : stagger++ * 4) : Number.POSITIVE_INFINITY,
      enterStyle: a.type === "zone" ? "fade" : a.type === "bar" ? "fade" : "pop",
      spawnFrom: null,
      exitF: null,
      moves: [],
      pulses: [],
      shakes: [],
      glows: [],
      dims: [],
      swaps: [],
      counts: [],
      grows: [],
      marks: [],
    });
  }

  const links: LinkTrack[] = [];
  const sends: SendTrack[] = [];
  const bursts: { a: string; f0: number }[] = [];
  const cues: Cue[] = [];
  if (hasHook) cues.push({ f: 3, kind: "hook" });

  // initial pops
  const initialFrames = new Set<number>();
  for (const tr of tracks.values()) {
    if (Number.isFinite(tr.enterF) && tr.actor.type !== "zone") initialFrames.add(tr.enterF);
  }
  for (const fr of initialFrames) cues.push({ f: fr, kind: "pop" });

  let diagramEnd = 2.5;
  for (const b of scene.beats) {
    const f0 = at(b.t);
    const f1 = at(b.t + b.d);
    diagramEnd = Math.max(diagramEnd, b.t + b.d);
    const tr = tracks.get(b.a);
    switch (b.do) {
      case "enter":
        if (tr) {
          tr.enterF = f0;
          tr.enterStyle = b.style || (tr.actor.type === "zone" ? "fade" : "pop");
          tr.spawnFrom = b.b && tracks.has(b.b) ? b.b : null;
          cues.push({ f: f0, kind: ["left", "right", "up", "down"].includes(b.style) || tr.spawnFrom ? "whoosh" : "pop" });
        }
        break;
      case "exit": {
        const link = links.find((l) => l.id === b.a);
        if (link) link.exitF = f0;
        else if (tr) tr.exitF = f0;
        cues.push({ f: f0, kind: "out" });
        break;
      }
      case "move":
        if (tr) {
          tr.moves.push({ f0, f1: Math.max(f1, f0 + 4), x: b.x, y: b.y });
          cues.push({ f: f0, kind: "whoosh" });
        }
        break;
      case "send":
        sends.push({ a: b.a, b: b.b, style: b.style || (b.text ? "bubble" : "token"), text: b.text, emoji: b.emoji, f0, f1: Math.max(f1, f0 + 14) });
        cues.push({ f: f0, kind: "whoosh" });
        cues.push({ f: Math.max(f1, f0 + 14), kind: "tick" });
        {
          const target = tracks.get(b.b);
          if (target) target.pulses.push(Math.max(f1, f0 + 14) - 2);
        }
        break;
      case "link":
        links.push({ id: b.id, a: b.a, b: b.b, style: b.style || "arrow", label: b.text, f0, f1: Math.max(f1, f0 + 6), exitF: null });
        cues.push({ f: f0, kind: "draw" });
        break;
      case "pulse":
        tr?.pulses.push(f0);
        cues.push({ f: f0, kind: "boop" });
        break;
      case "glow":
        tr?.glows.push({ f0, f1: Math.max(f1, f0 + 10) });
        cues.push({ f: f0, kind: "shimmer" });
        break;
      case "shake":
        tr?.shakes.push(f0);
        cues.push({ f: f0, kind: "buzz" });
        break;
      case "swap":
        tr?.swaps.push({ f: f0, emoji: b.emoji, label: b.text });
        cues.push({ f: f0, kind: "flip" });
        break;
      case "count":
        tr?.counts.push({ f0, f1: Math.max(f1, f0 + 6), v: b.value });
        cues.push({ f: f0, kind: "count", dur: b.d });
        break;
      case "grow":
        tr?.grows.push({ f0, f1: Math.max(f1, f0 + 6), v: b.value });
        cues.push({ f: f0, kind: "rise", dur: b.d });
        break;
      case "mark":
        tr?.marks.push({ f: f0, kind: b.style === "cross" ? "cross" : "check" });
        cues.push({ f: f0, kind: b.style === "cross" ? "buzz" : "ding" });
        break;
      case "dim":
        tr?.dims.push({ f: f0, on: b.style !== "off" });
        break;
      case "burst":
        bursts.push({ a: b.a, f0 });
        cues.push({ f: f0, kind: "sparkle" });
        break;
    }
  }

  const caps = scene.captions;
  if (caps.length) diagramEnd = Math.max(diagramEnd, caps[caps.length - 1].t + 1.6);
  diagramEnd = Math.min(diagramEnd, 13);
  const termAt = d0 + f(diagramEnd + 0.35);
  const total = termAt + f(3.7);

  const captions = caps.map((c, i) => ({
    f0: at(c.t),
    f1: i + 1 < caps.length ? at(caps[i + 1].t) : termAt - 2,
    text: c.text,
  }));

  cues.push({ f: termAt, kind: "impact" });
  if (scene.highlight) cues.push({ f: termAt + 20, kind: "swish" });

  // de-duplicate cues of the same kind within 2 frames, cap density
  cues.sort((p, q) => p.f - q.f);
  const deduped: Cue[] = [];
  for (const c of cues) {
    if (c.f >= total) continue;
    const last = deduped.findLast?.((d) => d.kind === c.kind) ?? [...deduped].reverse().find((d) => d.kind === c.kind);
    if (last && c.f - last.f < 3) continue;
    deduped.push(c);
  }

  const order = [...scene.actors]
    .sort((p, q) => (p.type === "zone" ? 0 : 1) - (q.type === "zone" ? 0 : 1))
    .map((a) => a.id);

  return {
    scene,
    d0,
    termAt,
    total,
    tracks,
    order,
    links,
    sends,
    bursts,
    captions,
    cues: deduped,
  };
}
