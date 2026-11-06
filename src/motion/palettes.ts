import type { ActorColor, Palette } from "@/lib/schema";

export const NAVY = "#1B1B3A";
export const YELLOW = "#FFD43B";
export const GREEN = "#22C55E";
export const RED = "#FF4D5E";

export const PALETTE_BG: Record<Palette, { top: string; mid: string; bottom: string; glow: string }> = {
  blue: { top: "#4B6BFB", mid: "#5B5CF6", bottom: "#6C4CF1", glow: "rgba(150,110,255,0.45)" },
  violet: { top: "#8B5CF6", mid: "#7C3AED", bottom: "#5B21B6", glow: "rgba(236,72,153,0.35)" },
  green: { top: "#23B26D", mid: "#169A5F", bottom: "#0E7C57", glow: "rgba(190,242,100,0.35)" },
  teal: { top: "#14B8D4", mid: "#0E9AB8", bottom: "#0B7A99", glow: "rgba(110,231,183,0.40)" },
  orange: { top: "#FF9F43", mid: "#FB7D2A", bottom: "#EA580C", glow: "rgba(253,224,71,0.40)" },
  pink: { top: "#F7679E", mid: "#EC4C88", bottom: "#C8296A", glow: "rgba(251,191,36,0.32)" },
  navy: { top: "#2E3A78", mid: "#232B5C", bottom: "#161A3D", glow: "rgba(99,102,241,0.45)" },
  red: { top: "#F45D5D", mid: "#E03E3E", bottom: "#B91C1C", glow: "rgba(251,146,60,0.40)" },
};

export const PALETTE_ACCENT: Record<Palette, string> = {
  blue: "#4B6BFB",
  violet: "#7C3AED",
  green: "#169A5F",
  teal: "#0E9AB8",
  orange: "#F06A1C",
  pink: "#E64980",
  navy: "#2E3A78",
  red: "#E03E3E",
};

export const FILL: Record<ActorColor, string> = {
  white: "#FFFFFF",
  yellow: "#FFE27A",
  blue: "#CFE0FF",
  green: "#C9F3D5",
  red: "#FFD0D4",
  purple: "#E2D6FF",
  orange: "#FFDDB8",
  navy: NAVY,
};

export const BAR_FILL: Record<ActorColor, string> = {
  white: "#FFFFFF",
  yellow: YELLOW,
  blue: "#5B8CFF",
  green: "#2BD576",
  red: "#FF5A6A",
  purple: "#A78BFA",
  orange: "#FF9B42",
  navy: NAVY,
};

export function bgCss(p: Palette) {
  const c = PALETTE_BG[p] ?? PALETTE_BG.blue;
  return `linear-gradient(180deg, ${c.top} 0%, ${c.mid} 55%, ${c.bottom} 100%)`;
}

export const outlineShadow = (w: number, drop: number, color = NAVY) =>
  [
    `${w}px 0 0 ${color}`,
    `-${w}px 0 0 ${color}`,
    `0 ${w}px 0 ${color}`,
    `0 -${w}px 0 ${color}`,
    `${w * 0.7}px ${w * 0.7}px 0 ${color}`,
    `-${w * 0.7}px ${w * 0.7}px 0 ${color}`,
    `${w * 0.7}px -${w * 0.7}px 0 ${color}`,
    `-${w * 0.7}px -${w * 0.7}px 0 ${color}`,
    `0 ${drop}px 0 ${color}`,
  ].join(", ");
