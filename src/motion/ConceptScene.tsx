"use client";

import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import type { Scene } from "@/lib/schema";
import {
  BAR_PX,
  BASE_H,
  CAPTION_Y,
  CARD_PX,
  DEF_TOP,
  EMOJI_PX,
  FPS,
  HOOK_Y,
  NUMBER_PX,
  PILL_FONT,
  STAGE,
  TERM_Y,
  TEXT_PX,
  W,
  bodyExtent,
  compile,
  sx,
  sy,
  textWidth,
  type ActorTrack,
  type Compiled,
} from "./timeline";
import { BAR_FILL, FILL, GREEN, NAVY, PALETTE_BG, RED, YELLOW, bgCss, outlineShadow } from "./palettes";

const JUA = "'Jua', 'Pretendard Variable', 'Pretendard', sans-serif";
const PRE = "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif";
const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface ConceptSceneProps {
  scene: Scene;
  height?: number;
  showCaptions?: boolean;
  [key: string]: unknown;
}

const compiledCache = new WeakMap<Scene, Compiled>();
export function getCompiled(scene: Scene): Compiled {
  let c = compiledCache.get(scene);
  if (!c) {
    c = compile(scene);
    compiledCache.set(scene, c);
  }
  return c;
}

const easeInOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);

function sp(frame: number, start: number, damping = 12, stiffness = 170, mass = 0.7) {
  return spring({ frame: frame - start, fps: FPS, config: { damping, stiffness, mass } });
}

/* ------------------------------------------------------------------ */
/*  Actor state at a frame                                             */
/* ------------------------------------------------------------------ */

interface ActorState {
  visible: boolean;
  x: number; // px
  y: number; // px
  scale: number;
  opacity: number;
  dx: number;
  dy: number;
  flip: number;
  emoji: string;
  label: string;
  value: number;
  glow: number;
  marks: { kind: "check" | "cross"; p: number }[];
}

function actorState(tr: ActorTrack, fr: number, c: Compiled, depth = 0): ActorState {
  const a = tr.actor;
  const hidden: ActorState = {
    visible: false,
    x: sx(tr.bx),
    y: sy(tr.by),
    scale: 0,
    opacity: 0,
    dx: 0,
    dy: 0,
    flip: 1,
    emoji: a.emoji,
    label: a.label,
    value: a.value,
    glow: 0,
    marks: [],
  };
  if (fr < tr.enterF) return hidden;
  if (tr.exitF !== null && fr >= tr.exitF + 8) return hidden;

  // position with moves
  let px = sx(tr.bx);
  let py = sy(tr.by);
  for (const m of tr.moves) {
    if (fr < m.f0) break;
    const t = easeInOut(Math.min(1, Math.max(0, (fr - m.f0) / Math.max(1, m.f1 - m.f0))));
    px = px + (sx(m.x) - px) * t;
    py = py + (sy(m.y) - py) * t;
  }

  // keep the body inside the frame horizontally (moves can target edges)
  if (a.type !== "zone" && a.type !== "bar") {
    const { hw } = bodyExtent(a);
    const lo = STAGE.x0 + hw - 20;
    const hi = STAGE.x0 + STAGE.w - hw + 20;
    px = lo > hi ? W / 2 : Math.min(hi, Math.max(lo, px));
  }

  // entrance
  const style = tr.enterStyle;
  const p = style === "drop" ? sp(fr, tr.enterF, 9, 160, 0.8) : sp(fr, tr.enterF, 12, 170, 0.7);
  let scale = 1;
  let opacity = 1;
  let dx = 0;
  let dy = 0;
  if (tr.spawnFrom && depth < 3) {
    const src = c.tracks.get(tr.spawnFrom);
    if (src) {
      const s = actorState(src, tr.enterF, c, depth + 1);
      const k = Math.min(1, Math.max(0, interpolate(fr, [tr.enterF, tr.enterF + 16], [0, 1], CL)));
      const e = easeOut(k);
      px = s.x + (px - s.x) * e;
      py = s.y + (py - s.y) * e;
      scale = 0.35 + 0.65 * Math.min(1, p);
    }
  } else if (style === "left") dx = (1 - p) * -700;
  else if (style === "right") dx = (1 - p) * 700;
  else if (style === "up") dy = (1 - p) * 600;
  else if (style === "down" || style === "drop") dy = (1 - p) * -700;
  else if (style === "fade") opacity = interpolate(fr, [tr.enterF, tr.enterF + 10], [0, 1], CL);
  else scale = p;

  // exit
  if (tr.exitF !== null && fr >= tr.exitF) {
    const q = Math.min(1, (fr - tr.exitF) / 8);
    scale *= 1 - 0.4 * q;
    opacity *= 1 - q;
  }

  // pulses & shakes
  for (const pf of tr.pulses) {
    const k = fr - pf;
    if (k >= 0 && k < 12) scale *= 1 + 0.14 * Math.sin((Math.PI * k) / 12);
  }
  for (const s of tr.shakes) {
    const k = fr - s;
    if (k >= 0 && k < 16) dx += Math.sin(k * 1.9) * 16 * (1 - k / 16);
  }

  // glow
  let glow = 0;
  for (const g of tr.glows) {
    if (fr >= g.f0 && fr <= g.f1 + 8) {
      const up = interpolate(fr, [g.f0, g.f0 + 6], [0, 1], CL);
      const down = interpolate(fr, [g.f1, g.f1 + 8], [1, 0], CL);
      glow = Math.max(glow, up * down);
    }
  }

  // dim
  let dimOp = 1;
  for (const d of tr.dims) {
    if (fr >= d.f) {
      const k = interpolate(fr, [d.f, d.f + 8], [0, 1], CL);
      const from = dimOp;
      const to = d.on ? 0.32 : 1;
      dimOp = from + (to - from) * k;
    }
  }
  opacity *= dimOp;

  // swaps
  let emoji = a.emoji;
  let label = a.label;
  let flip = 1;
  for (const s of tr.swaps) {
    const k = fr - s.f;
    if (k >= 5) {
      if (s.emoji) emoji = s.emoji;
      if (s.label) label = s.label;
    }
    if (k >= 0 && k <= 10) flip = Math.max(0.02, Math.abs(Math.cos((Math.PI * k) / 10)));
  }

  // counts / grows
  let value = a.value;
  const series = a.type === "bar" ? tr.grows : tr.counts;
  for (const s of series) {
    if (fr < s.f0) break;
    const t = easeOut(Math.min(1, (fr - s.f0) / Math.max(1, s.f1 - s.f0)));
    value = value + (s.v - value) * t;
  }

  const marks = tr.marks.filter((m) => fr >= m.f).map((m) => ({ kind: m.kind, p: sp(fr, m.f, 10, 220, 0.6) }));

  return { visible: true, x: px, y: py, scale, opacity, dx, dy, flip, emoji, label, value, glow, marks };
}

/* ------------------------------------------------------------------ */
/*  Actor renderers                                                    */
/* ------------------------------------------------------------------ */

const labelStyle: React.CSSProperties = {
  font: `800 42px ${PRE}`,
  color: "#fff",
  textAlign: "center",
  lineHeight: 1.15,
  letterSpacing: -0.5,
  textShadow: `0 3px 0 rgba(27,27,58,0.45)`,
  maxWidth: 320,
  wordBreak: "keep-all",
};

function formatValue(v: number, target: number) {
  const decimals = Math.abs(target % 1) > 0 ? 1 : 0;
  return v.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function Marks({ marks, size }: { marks: ActorState["marks"]; size: number }) {
  return (
    <>
      {marks.map((m, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            right: -size * 0.12 - i * 14,
            top: -size * 0.12 - i * 14,
            width: 76,
            height: 76,
            borderRadius: 40,
            background: m.kind === "check" ? GREEN : RED,
            border: `6px solid ${NAVY}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${m.p})`,
            boxShadow: `0 6px 0 ${NAVY}`,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40">
            {m.kind === "check" ? (
              <path d="M8 21 L17 30 L33 11" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M10 10 L30 30 M30 10 L10 30" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
            )}
          </svg>
        </div>
      ))}
    </>
  );
}

function ActorView({ tr, st, maxValue }: { tr: ActorTrack; st: ActorState; maxValue: number }) {
  const a = tr.actor;
  if (!st.visible) return null;
  const glowShadow = st.glow > 0 ? `0 0 ${70 * st.glow}px ${24 * st.glow}px rgba(255,212,59,${0.75 * st.glow})` : "";
  const wrap = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div
      style={{
        position: "absolute",
        left: st.x + st.dx,
        top: st.y + st.dy,
        transform: `translate(-50%, -50%) scale(${st.scale}) scaleX(${st.flip})`,
        opacity: st.opacity,
        ...extra,
      }}
    >
      {children}
    </div>
  );

  switch (a.type) {
    case "card":
    case "circle": {
      const s = CARD_PX[a.size];
      const fill = FILL[a.color];
      return wrap(
        <div style={{ position: "relative", width: s, height: s }}>
          <div
            style={{
              width: s,
              height: s,
              boxSizing: "border-box",
              background: fill,
              border: `8px solid ${NAVY}`,
              borderRadius: a.type === "circle" ? s : s * 0.2,
              boxShadow: [`0 12px 0 ${NAVY}`, glowShadow].filter(Boolean).join(", "),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `${s * 0.5}px/1 ${EMOJI_FONT}`,
              color: a.color === "navy" ? "#fff" : NAVY,
            }}
          >
            {st.emoji || (
              <span style={{ font: `400 ${s * 0.26}px/1.05 ${JUA}`, textAlign: "center", padding: 10, wordBreak: "keep-all" }}>
                {st.label}
              </span>
            )}
          </div>
          {st.emoji && st.label ? (
            <div style={{ ...labelStyle, position: "absolute", top: s + 22, left: "50%", transform: "translateX(-50%)", width: "max-content" }}>
              {st.label}
            </div>
          ) : null}
          <Marks marks={st.marks} size={s} />
        </div>,
      );
    }
    case "emoji": {
      const s = EMOJI_PX[a.size];
      return wrap(
        <div style={{ position: "relative", width: s * 1.1, height: s * 1.1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {st.glow > 0 ? (
            <div
              style={{
                position: "absolute",
                inset: -20,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(255,212,59,${0.7 * st.glow}), rgba(255,212,59,0) 70%)`,
              }}
            />
          ) : null}
          <div style={{ font: `${s}px/1 ${EMOJI_FONT}`, filter: "drop-shadow(0 10px 0 rgba(27,27,58,0.35))" }}>{st.emoji || "✨"}</div>
          {st.label ? (
            <div style={{ ...labelStyle, position: "absolute", top: s * 1.1 + 10, left: "50%", transform: "translateX(-50%)", width: "max-content" }}>
              {st.label}
            </div>
          ) : null}
          <Marks marks={st.marks} size={s} />
        </div>,
      );
    }
    case "pill": {
      const navy = a.color === "navy" || a.color === "white";
      const bg = a.color === "white" ? "#fff" : navy ? NAVY : FILL[a.color];
      const fg = a.color === "white" ? NAVY : navy ? YELLOW : NAVY;
      return wrap(
        <div
          style={{
            position: "relative",
            height: 100,
            padding: "0 44px",
            borderRadius: 50,
            background: bg,
            border: `6px solid ${a.color === "white" ? NAVY : "#fff"}`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            font: `400 ${PILL_FONT}px/1 ${JUA}`,
            color: fg,
            whiteSpace: "nowrap",
            boxShadow: [`0 8px 0 rgba(27,27,58,0.45)`, glowShadow].filter(Boolean).join(", "),
          }}
        >
          {st.emoji ? <span style={{ font: `52px/1 ${EMOJI_FONT}` }}>{st.emoji}</span> : null}
          {st.label}
          <Marks marks={st.marks} size={100} />
        </div>,
      );
    }
    case "text": {
      const fsz = TEXT_PX[a.size];
      const color = a.color === "yellow" ? YELLOW : a.color === "white" || a.color === "navy" ? "#fff" : FILL[a.color];
      return wrap(
        <div
          style={{
            position: "relative",
            font: `400 ${fsz}px/1.12 ${JUA}`,
            color,
            textAlign: "center",
            maxWidth: 900,
            width: "max-content",
            textShadow: outlineShadow(Math.max(4, fsz / 16), Math.max(6, fsz / 9)),
            filter: st.glow > 0 ? `drop-shadow(0 0 ${30 * st.glow}px rgba(255,212,59,${0.9 * st.glow}))` : undefined,
            wordBreak: "keep-all",
          }}
        >
          {st.emoji ? <span style={{ font: `${fsz}px/1 ${EMOJI_FONT}`, marginRight: 12 }}>{st.emoji}</span> : null}
          {st.label}
          <Marks marks={st.marks} size={fsz} />
        </div>,
      );
    }
    case "number": {
      const fsz = NUMBER_PX[a.size];
      const target = tr.counts.length ? tr.counts[tr.counts.length - 1].v : a.value;
      return wrap(
        <div
          style={{
            position: "relative",
            font: `400 ${fsz}px/1 ${JUA}`,
            color: a.color === "yellow" ? YELLOW : "#fff",
            whiteSpace: "nowrap",
            textShadow: outlineShadow(Math.max(5, fsz / 18), Math.max(8, fsz / 10)),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {st.emoji ? <span style={{ font: `${fsz * 0.8}px/1 ${EMOJI_FONT}`, marginRight: 10 }}>{st.emoji}</span> : null}
          {formatValue(st.value, target)}
          <span style={{ fontSize: fsz * 0.55 }}>{st.label}</span>
          <Marks marks={st.marks} size={fsz} />
        </div>,
      );
    }
    case "bar": {
      const bw = BAR_PX[a.size];
      const maxH = ((a.h || 45) / 100) * STAGE.h;
      const hpx = Math.max(6, (Math.max(0, Math.min(maxValue, st.value)) / Math.max(1, maxValue)) * maxH);
      return (
        <div
          style={{
            position: "absolute",
            left: st.x + st.dx,
            top: st.y + st.dy,
            width: 0,
            height: 0,
            opacity: st.opacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -bw / 2,
              bottom: 0,
              width: bw,
              height: hpx,
              boxSizing: "border-box",
              background: BAR_FILL[a.color],
              border: `7px solid ${NAVY}`,
              borderRadius: "22px 22px 8px 8px",
              boxShadow: [`0 8px 0 ${NAVY}`, glowShadow].filter(Boolean).join(", "),
              transformOrigin: "bottom",
              transform: `scaleY(${Math.min(1, st.scale)})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: hpx + 18,
              transform: "translateX(-50%)",
              font: `400 50px/1 ${JUA}`,
              color: "#fff",
              whiteSpace: "nowrap",
              textShadow: outlineShadow(4, 6),
            }}
          >
            {st.emoji ? <span style={{ font: `44px/1 ${EMOJI_FONT}`, marginRight: 6 }}>{st.emoji}</span> : null}
            {formatValue(st.value, tr.grows.length ? tr.grows[tr.grows.length - 1].v : a.value)}
          </div>
          {st.label ? (
            <div style={{ ...labelStyle, position: "absolute", top: 22, left: 0, transform: "translateX(-50%)", width: "max-content" }}>
              {st.label}
            </div>
          ) : null}
        </div>
      );
    }
    case "zone": {
      const zw = ((a.w || 60) / 100) * STAGE.w;
      const zh = ((a.h || 50) / 100) * STAGE.h;
      return wrap(
        <div
          style={{
            position: "relative",
            width: zw,
            height: zh,
            borderRadius: 44,
            background: a.color === "white" ? "rgba(255,255,255,0.13)" : `${FILL[a.color]}33`,
            border: `5px dashed rgba(255,255,255,0.75)`,
            boxSizing: "border-box",
            boxShadow: glowShadow || undefined,
          }}
        >
          {st.label || st.emoji ? (
            <div
              style={{
                position: "absolute",
                left: 24,
                top: -30,
                padding: "8px 22px",
                borderRadius: 999,
                background: "#fff",
                border: `5px solid ${NAVY}`,
                font: `800 34px ${PRE}`,
                color: NAVY,
                whiteSpace: "nowrap",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              {st.emoji ? <span style={{ font: `34px/1 ${EMOJI_FONT}` }}>{st.emoji}</span> : null}
              {st.label}
            </div>
          ) : null}
        </div>,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Links, sends, bursts                                               */
/* ------------------------------------------------------------------ */

function trimPoint(x: number, y: number, tx: number, ty: number, hw: number, hh: number, pad: number) {
  const dx = tx - x;
  const dy = ty - y;
  const ax = Math.abs(dx) || 1e-6;
  const ay = Math.abs(dy) || 1e-6;
  const t = Math.min((hw + pad) / ax, (hh + pad) / ay);
  return { x: x + dx * Math.min(t, 0.48), y: y + dy * Math.min(t, 0.48) };
}

function Bubble({ x, y, text, emoji, bg, tail, scale, opacity }: { x: number; y: number; text: string; emoji: string; bg: string; tail: "down" | "up"; scale: number; opacity: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})`, opacity }}>
      <div
        style={{
          position: "relative",
          background: bg,
          border: `6px solid ${NAVY}`,
          borderRadius: 30,
          padding: "12px 30px 16px",
          font: `400 50px ${JUA}`,
          color: NAVY,
          whiteSpace: "nowrap",
          boxShadow: `0 8px 0 ${NAVY}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {emoji ? <span style={{ font: `46px/1 ${EMOJI_FONT}` }}>{emoji}</span> : null}
        {text}
        <div
          style={
            {
              position: "absolute",
              left: "50%",
              marginLeft: -13,
              [tail === "down" ? "bottom" : "top"]: -17,
              width: 26,
              height: 26,
              background: bg,
              transform: "rotate(45deg)",
              borderRight: tail === "down" ? `6px solid ${NAVY}` : "none",
              borderBottom: tail === "down" ? `6px solid ${NAVY}` : "none",
              borderLeft: tail === "up" ? `6px solid ${NAVY}` : "none",
              borderTop: tail === "up" ? `6px solid ${NAVY}` : "none",
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Term block                                                         */
/* ------------------------------------------------------------------ */

function splitTerm(term: string): { lines: string[]; size: number } {
  const one = textWidth(term, 1);
  const size1 = Math.min(300, 960 / Math.max(one, 0.01));
  if (size1 >= 130 || !term.includes(" ")) return { lines: [term], size: Math.max(70, size1) };
  // split near the middle at a space
  const words = term.split(" ");
  let best = { lines: [term], max: one };
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    const m = Math.max(textWidth(l1, 1), textWidth(l2, 1));
    if (m < best.max) best = { lines: [l1, l2], max: m };
  }
  return { lines: best.lines, size: Math.max(70, Math.min(190, 960 / best.max)) };
}

function TermBlock({ scene, fr, termAt, oy }: { scene: Scene; fr: number; termAt: number; oy: number }) {
  if (fr < termAt) return null;
  const s = sp(fr, termAt, 9, 260, 0.9);
  const scale = interpolate(s, [0, 1], [2.4, 1]);
  const op = interpolate(fr, [termAt, termAt + 4], [0, 1], CL);
  const shakeAmt = interpolate(fr, [termAt + 5, termAt + 18], [14, 0], CL);
  const shx = shakeAmt * (random(`sx${fr}`) - 0.5) * 2;
  const shy = shakeAmt * (random(`sy${fr}`) - 0.5) * 2;
  const { lines, size } = splitTerm(scene.term);
  const lh = size * 1.02;
  const blockH = lh * lines.length;

  const subIn = sp(fr, termAt + 12, 14, 160);
  const hl = interpolate(fr, [termAt + 20, termAt + 32], [0, 1], { ...CL, easing: easeOut });
  const def = scene.definition;
  const defSize = def.length > 26 ? 52 : def.length > 20 ? 58 : def.length > 14 ? 64 : 72;
  const parts: { text: string; hl: boolean }[] = [];
  if (scene.highlight && def.includes(scene.highlight)) {
    const i = def.indexOf(scene.highlight);
    if (i > 0) parts.push({ text: def.slice(0, i), hl: false });
    parts.push({ text: scene.highlight, hl: true });
    if (i + scene.highlight.length < def.length) parts.push({ text: def.slice(i + scene.highlight.length), hl: false });
  } else parts.push({ text: def, hl: false });

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: oy + TERM_Y - blockH / 2,
          left: 0,
          width: W,
          textAlign: "center",
          font: `400 ${size}px/${lh}px ${JUA}`,
          letterSpacing: size > 200 ? -4 : -2,
          color: "#fff",
          textShadow: outlineShadow(Math.max(5, size / 40), Math.max(10, size / 17)),
          opacity: op,
          transform: `translate(${shx}px, ${shy}px) scale(${scale})`,
          whiteSpace: "nowrap",
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      {def ? (
        <div
          style={{
            position: "absolute",
            top: oy + Math.max(DEF_TOP, TERM_Y + blockH / 2 + 40),
            left: 50,
            width: W - 100,
            textAlign: "center",
            font: `400 ${defSize}px/1.45 ${JUA}`,
            color: "#fff",
            textShadow: `0 5px 0 ${NAVY}`,
            opacity: Math.min(1, subIn),
            transform: `translateY(${(1 - subIn) * 40}px)`,
            wordBreak: "keep-all",
            textWrap: "balance",
          }}
        >
          {parts.map((p, i) =>
            p.hl ? (
              <span
                key={i}
                style={{
                  color: NAVY,
                  textShadow: "none",
                  background: YELLOW,
                  border: `6px solid ${NAVY}`,
                  borderRadius: 18,
                  padding: "0px 18px 4px",
                  margin: "0 6px",
                  boxShadow: `0 6px 0 ${NAVY}`,
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                  clipPath: `inset(-20px ${100 - hl * 100}% -20px -20px)`,
                }}
              >
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main composition                                                   */
/* ------------------------------------------------------------------ */

export const ConceptScene: React.FC<ConceptSceneProps> = ({ scene, height = BASE_H, showCaptions = true }) => {
  const fr = useCurrentFrame();
  const c = useMemo(() => getCompiled(scene), [scene]);
  const H = height;
  const oy = Math.round((H - BASE_H) / 2);
  const pal = PALETTE_BG[scene.palette] ?? PALETTE_BG.blue;
  const drift = Math.sin(fr / 40) * 40;

  // states
  const states = new Map<string, ActorState>();
  for (const id of c.order) {
    const tr = c.tracks.get(id)!;
    states.set(id, actorState(tr, fr, c));
  }
  const barMax = Math.max(
    100,
    ...[...c.tracks.values()].filter((t) => t.actor.type === "bar").flatMap((t) => [t.actor.value, ...t.grows.map((g) => g.v)]),
  );

  // hook
  const hookIn = sp(fr, 2, 13, 140);
  const hookOut = interpolate(fr, [c.d0 - 12, c.d0], [1, 0], CL);

  // stage shrink at term
  const shrink = interpolate(fr, [c.termAt - 6, c.termAt + 10], [0, 1], { ...CL, easing: easeOut });
  const stageScale = 1 - 0.14 * shrink;
  const endFade = interpolate(fr, [c.total - 8, c.total - 1], [1, 0], CL);

  return (
    <AbsoluteFill style={{ background: bgCss(scene.palette), overflow: "hidden", fontFamily: PRE }}>
      {/* soft glows */}
      <div
        style={{
          position: "absolute",
          left: -260 + drift,
          top: oy + 180,
          width: 760,
          height: 760,
          borderRadius: 760,
          background: "radial-gradient(circle, rgba(255,255,255,0.20), rgba(255,255,255,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -300 - drift,
          top: oy + 1180,
          width: 900,
          height: 900,
          borderRadius: 900,
          background: `radial-gradient(circle, ${pal.glow}, rgba(0,0,0,0) 70%)`,
        }}
      />

      <div style={{ position: "absolute", inset: 0, opacity: endFade }}>
        {/* hook */}
        {scene.hook && fr < c.d0 ? (
          <div
            style={{
              position: "absolute",
              top: oy + HOOK_Y,
              left: 60,
              width: W - 120,
              textAlign: "center",
              font: `400 104px/1.14 ${JUA}`,
              color: "#fff",
              textShadow: "0 7px 0 rgba(27,27,58,0.38)",
              opacity: Math.min(hookIn, 1) * hookOut,
              transform: `translateY(calc(-50% + ${(1 - hookIn) * 70 - (1 - hookOut) * 60}px)) scale(${(0.85 + 0.15 * hookIn) * (0.9 + 0.1 * hookOut)})`,
              wordBreak: "keep-all",
              textWrap: "balance",
            }}
          >
            {scene.hook}
          </div>
        ) : null}

        {/* stage */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: oy,
            width: W,
            height: BASE_H,
            transformOrigin: `${W / 2}px ${STAGE.y0}px`,
            transform: `translateY(${-40 * shrink}px) scale(${stageScale})`,
          }}
        >
          {/* zones */}
          {c.order
            .filter((id) => c.tracks.get(id)!.actor.type === "zone")
            .map((id) => (
              <ActorView key={id} tr={c.tracks.get(id)!} st={states.get(id)!} maxValue={barMax} />
            ))}

          {/* links */}
          <svg width={W} height={BASE_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {c.links.map((l, i) => {
              const A = states.get(l.a);
              const B = states.get(l.b);
              const ta = c.tracks.get(l.a);
              const tb = c.tracks.get(l.b);
              if (!A || !B || !ta || !tb || !A.visible || !B.visible || fr < l.f0) return null;
              const exitOp = l.exitF !== null ? interpolate(fr, [l.exitF, l.exitF + 8], [1, 0], CL) : 1;
              if (exitOp <= 0) return null;
              const ea = bodyExtent(ta.actor, A.label);
              const eb = bodyExtent(tb.actor, B.label);
              const ax = A.x + A.dx;
              const ay = A.y + A.dy;
              const bx = B.x + B.dx;
              const by = B.y + B.dy;
              const p0 = trimPoint(ax, ay, bx, by, ea.hw, ea.hh, 22);
              const p1 = trimPoint(bx, by, ax, ay, eb.hw, eb.hh, 22);
              const prog = easeOut(interpolate(fr, [l.f0, l.f1], [0, 1], CL));
              const ex = p0.x + (p1.x - p0.x) * prog;
              const ey = p0.y + (p1.y - p0.y) * prog;
              const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
              const head = (x: number, y: number, an: number) => {
                const s = 30;
                const pts = [
                  [x, y],
                  [x - s * Math.cos(an - 0.5), y - s * Math.sin(an - 0.5)],
                  [x - s * Math.cos(an + 0.5), y - s * Math.sin(an + 0.5)],
                ];
                return pts.map((p) => p.join(",")).join(" ");
              };
              const flow = l.style === "flow";
              const showHead = (l.style === "arrow" || l.style === "both" || l.style === "flow") && prog > 0.85;
              const labOp = interpolate(fr, [l.f1 - 2, l.f1 + 6], [0, 1], CL);
              const mx = (p0.x + p1.x) / 2;
              const my = (p0.y + p1.y) / 2;
              return (
                <g key={`${l.id}${i}`} opacity={exitOp * Math.min(A.opacity, B.opacity, 1)}>
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={ex}
                    y2={ey}
                    stroke="rgba(27,27,58,0.35)"
                    strokeWidth={14}
                    strokeLinecap="round"
                    transform="translate(0,6)"
                    strokeDasharray={flow ? "20 18" : undefined}
                    strokeDashoffset={flow ? -fr * 3 : undefined}
                  />
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={ex}
                    y2={ey}
                    stroke="#fff"
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeDasharray={flow ? "20 18" : undefined}
                    strokeDashoffset={flow ? -fr * 3 : undefined}
                  />
                  {showHead ? <polygon points={head(p1.x, p1.y, ang)} fill="#fff" stroke="#fff" strokeWidth={6} strokeLinejoin="round" /> : null}
                  {l.style === "both" && prog > 0.85 ? (
                    <polygon points={head(p0.x, p0.y, ang + Math.PI)} fill="#fff" stroke="#fff" strokeWidth={6} strokeLinejoin="round" />
                  ) : null}
                  {l.label ? (
                    <foreignObject x={mx - 200} y={my - 34} width={400} height={68} opacity={labOp} style={{ overflow: "visible" }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div
                          style={{
                            padding: "6px 22px",
                            borderRadius: 999,
                            background: YELLOW,
                            border: `5px solid ${NAVY}`,
                            font: `400 38px/1.15 ${JUA}`,
                            color: NAVY,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {l.label}
                        </div>
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* actors */}
          {c.order
            .filter((id) => c.tracks.get(id)!.actor.type !== "zone")
            .map((id) => (
              <ActorView key={id} tr={c.tracks.get(id)!} st={states.get(id)!} maxValue={barMax} />
            ))}

          {/* sends */}
          {c.sends.map((s, i) => {
            if (fr < s.f0 || fr > s.f1 + 2) return null;
            const A = states.get(s.a);
            const B = states.get(s.b);
            const ta = c.tracks.get(s.a);
            const tb = c.tracks.get(s.b);
            if (!A || !B || !ta || !tb) return null;
            const ax = A.x;
            const ay = A.y;
            const bx = B.x;
            const by = B.y;
            const len = Math.hypot(bx - ax, by - ay) || 1;
            // left normal of the direction → opposite directions use opposite lanes
            const nx = (by - ay) / len;
            const ny = -(bx - ax) / len;
            const ea = bodyExtent(ta.actor);
            const eb = bodyExtent(tb.actor);
            const isBubble = s.style === "bubble" || s.style === "answer";
            const labelPad = ny > 0.3 ? 76 : 0; // lanes below cards must clear their labels
            const lane = isBubble ? Math.max(ea.hh, eb.hh) + 70 + labelPad : 0;
            const appear = sp(fr, s.f0, 11, 220);
            const t = easeInOut(interpolate(fr, [s.f0 + 4, s.f1 - 4], [0, 1], CL));
            const out = interpolate(fr, [s.f1 - 4, s.f1 + 2], [1, 0], CL);
            const arc = isBubble ? 0 : Math.sin(Math.PI * t) * -60;
            const x = ax + (bx - ax) * t + nx * lane;
            const y = ay + (by - ay) * t + ny * lane + arc;
            if (isBubble) {
              const bg = s.style === "answer" ? YELLOW : "#fff";
              return (
                <Bubble
                  key={i}
                  x={x}
                  y={y}
                  text={s.text}
                  emoji={s.emoji}
                  bg={bg}
                  tail={ny * lane < 0 ? "down" : "up"}
                  scale={Math.min(1.05, appear) * (0.6 + 0.4 * out)}
                  opacity={out}
                />
              );
            }
            if (s.style === "pill") {
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    transform: `translate(-50%, -50%) scale(${Math.min(1, appear)})`,
                    opacity: out,
                    padding: "10px 30px",
                    borderRadius: 999,
                    background: NAVY,
                    border: "5px solid #fff",
                    font: `400 46px/1 ${JUA}`,
                    color: YELLOW,
                    whiteSpace: "nowrap",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {s.emoji ? <span style={{ font: `42px/1 ${EMOJI_FONT}` }}>{s.emoji}</span> : null}
                  {s.text}
                </div>
              );
            }
            // token (emoji) with trail
            const trail = [0.12, 0.08, 0.04].map((lag, k) => {
              const tt = Math.max(0, t - lag);
              return {
                x: ax + (bx - ax) * tt,
                y: ay + (by - ay) * tt + Math.sin(Math.PI * tt) * -60,
                o: (0.35 - k * 0.1) * out,
              };
            });
            return (
              <React.Fragment key={i}>
                {t > 0.05
                  ? trail.map((p, k) => (
                      <div
                        key={k}
                        style={{
                          position: "absolute",
                          left: p.x,
                          top: p.y,
                          transform: "translate(-50%, -50%)",
                          font: `84px/1 ${EMOJI_FONT}`,
                          opacity: p.o,
                        }}
                      >
                        {s.emoji || "✉️"}
                      </div>
                    ))
                  : null}
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    transform: `translate(-50%, -50%) scale(${Math.min(1.1, appear)})`,
                    opacity: out,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div style={{ font: `92px/1 ${EMOJI_FONT}`, filter: "drop-shadow(0 8px 0 rgba(27,27,58,0.35))" }}>{s.emoji || "✉️"}</div>
                  {s.text ? (
                    <div
                      style={{
                        padding: "4px 18px",
                        borderRadius: 999,
                        background: "#fff",
                        border: `4px solid ${NAVY}`,
                        font: `400 34px/1.1 ${JUA}`,
                        color: NAVY,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.text}
                    </div>
                  ) : null}
                </div>
              </React.Fragment>
            );
          })}

          {/* bursts */}
          {c.bursts.map((b, i) => {
            const k = fr - b.f0;
            if (k < 0 || k > 44) return null;
            const st = states.get(b.a);
            if (!st) return null;
            const colors = [YELLOW, "#4B6BFB", GREEN, "#FF3D71", "#FF8A00", "#fff"];
            return (
              <React.Fragment key={i}>
                {Array.from({ length: 24 }).map((_, j) => {
                  const ang = (-90 + (random(`a${i}${j}`) - 0.5) * 300) * (Math.PI / 180);
                  const spd = 12 + random(`s${i}${j}`) * 16;
                  const x = st.x + Math.cos(ang) * spd * k;
                  const y = st.y + Math.sin(ang) * spd * k + 0.7 * k * k;
                  const size = 14 + random(`z${i}${j}`) * 12;
                  const op = interpolate(k, [0, 3, 30, 44], [0, 1, 1, 0], CL);
                  return (
                    <div
                      key={j}
                      style={{
                        position: "absolute",
                        left: x,
                        top: y,
                        width: size,
                        height: size * (random(`r${i}${j}`) > 0.5 ? 1 : 0.5),
                        borderRadius: random(`c${i}${j}`) > 0.6 ? size : 4,
                        background: colors[j % colors.length],
                        transform: `rotate(${k * (8 + random(`w${i}${j}`) * 14)}deg)`,
                        opacity: op,
                      }}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {/* captions */}
        {showCaptions
          ? c.captions.map((cap, i) => {
              if (fr < cap.f0 || fr >= cap.f1 || fr >= c.termAt) return null;
              const inP = sp(fr, cap.f0 + 1, 14, 180);
              const outP = interpolate(fr, [cap.f1 - 6, cap.f1], [1, 0], CL);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: oy + CAPTION_Y,
                    left: W / 2,
                    transform: `translate(-50%, calc(-50% + ${(1 - Math.min(inP, 1)) * 30}px))`,
                    opacity: Math.min(inP, 1) * outP,
                    maxWidth: 940,
                    width: "max-content",
                    padding: "18px 36px 20px",
                    borderRadius: 30,
                    background: "rgba(20,20,52,0.42)",
                    font: `700 54px/1.32 ${PRE}`,
                    letterSpacing: -1,
                    color: "#fff",
                    textAlign: "center",
                    wordBreak: "keep-all",
                    textWrap: "balance",
                  }}
                >
                  {cap.text}
                </div>
              );
            })
          : null}

        <TermBlock scene={scene} fr={fr} termAt={c.termAt} oy={oy} />
      </div>
    </AbsoluteFill>
  );
};

export default ConceptScene;
