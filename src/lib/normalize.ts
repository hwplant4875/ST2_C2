import {
  ACTIONS,
  ACTOR_TYPES,
  COLORS,
  PALETTES,
  SIZES,
  STYLES,
  type Action,
  type Actor,
  type Beat,
  type Caption,
  type Quiz,
  type Scene,
} from "./schema";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

/** Default durations (seconds) per action. */
export const DEFAULT_DUR: Record<Action, number> = {
  enter: 0.6,
  exit: 0.4,
  move: 0.9,
  send: 1.1,
  link: 0.5,
  pulse: 0.4,
  glow: 1.6,
  shake: 0.5,
  swap: 0.4,
  count: 1.2,
  grow: 1.0,
  mark: 0.4,
  dim: 0.3,
  burst: 1.2,
};

const MAX_DIAGRAM = 12; // seconds

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeQuiz(q: Partial<Quiz> | undefined, term: string): Quiz {
  const options = Array.isArray(q?.options) ? q!.options.map((o) => str(o, 60)).filter(Boolean) : [];
  let answer = clamp(Math.round(num(q?.answer, 0)), 0, Math.max(0, options.length - 1));
  const correct = options[answer] ?? term;
  // make sure there are exactly 4 unique options
  const uniq: string[] = [];
  for (const o of options) if (!uniq.includes(o)) uniq.push(o);
  const fillers = ["해당 없음", "모두 맞다", "알 수 없음"];
  for (const f of fillers) if (uniq.length < 4 && !uniq.includes(f)) uniq.push(f);
  let four = uniq.slice(0, 4);
  if (!four.includes(correct)) four[3] = correct;
  // shuffle deterministically so the answer is not always in the same slot
  four = seededShuffle(four, hash(term + (q?.question ?? "")));
  answer = four.indexOf(correct);
  return {
    question: str(q?.question, 160) || `'${term}'에 대한 설명으로 옳은 것은?`,
    options: four,
    answer,
    explanation: str(q?.explanation, 240),
  };
}

export function normalizeScene(raw: Partial<Scene>, fallbackTerm = ""): Scene {
  const term = str(raw.term, 40) || fallbackTerm || "개념";
  const palette = oneOf(PALETTES, raw.palette, "blue");

  // ---- actors -------------------------------------------------------
  const seen = new Set<string>();
  const actors: Actor[] = [];
  for (const a of Array.isArray(raw.actors) ? raw.actors.slice(0, 14) : []) {
    if (!a || typeof a !== "object") continue;
    let id = str(a.id, 24) || `a${actors.length + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    const type = oneOf(ACTOR_TYPES, a.type, "card");
    actors.push({
      id,
      type,
      emoji: str(a.emoji, 16),
      label: str(a.label, type === "text" || type === "pill" ? 40 : 24),
      x: clamp(num(a.x, 50), 0, 100),
      y: clamp(num(a.y, 50), 0, 100),
      w: clamp(num(a.w, type === "zone" ? 60 : 0), 0, 100),
      h: clamp(num(a.h, type === "zone" ? 50 : 0), 0, 100),
      size: oneOf(SIZES, a.size, "m"),
      color: oneOf(COLORS, a.color, type === "pill" ? "navy" : "white"),
      value: num(a.value, 0),
      hidden: Boolean(a.hidden),
    });
  }
  if (actors.length === 0) {
    actors.push({
      id: "main",
      type: "pill",
      emoji: "",
      label: term,
      x: 50,
      y: 50,
      w: 0,
      h: 0,
      size: "l",
      color: "navy",
      value: 0,
      hidden: false,
    });
  }
  const ids = new Set(actors.map((a) => a.id));

  // ---- beats --------------------------------------------------------
  const linkIds = new Set<string>();
  const beats: Beat[] = [];
  const rawBeats = Array.isArray(raw.beats) ? raw.beats.slice(0, 40) : [];
  const sorted = rawBeats
    .filter((b) => b && typeof b === "object")
    .map((b) => ({ ...b, t: clamp(num(b.t, 0), 0, MAX_DIAGRAM) }))
    .sort((p, q) => p.t - q.t);

  for (const b of sorted) {
    const action = oneOf(ACTIONS, b.do, "pulse");
    if (!(ACTIONS as readonly string[]).includes(b.do as string)) continue;
    const a = str(b.a, 24);
    const bb = str(b.b, 24);
    const isLinkTarget = action === "exit" && linkIds.has(a);
    if (!ids.has(a) && !isLinkTarget) continue;
    if ((action === "send" || action === "link") && (!ids.has(bb) || bb === a)) continue;
    let id = str(b.id, 24);
    if (action === "link") {
      if (!id || ids.has(id) || linkIds.has(id)) id = `link${linkIds.size + 1}`;
      linkIds.add(id);
    }
    const d = num(b.d, 0) > 0 ? clamp(num(b.d, 0), 0.15, 4) : DEFAULT_DUR[action];
    beats.push({
      t: b.t,
      do: action,
      a,
      b: ids.has(bb) ? bb : "",
      x: clamp(num(b.x, 50), 0, 100),
      y: clamp(num(b.y, 50), 0, 100),
      text: str(b.text, 24),
      emoji: str(b.emoji, 16),
      value: num(b.value, 0),
      style: oneOf(STYLES, b.style, ""),
      d,
      id,
    });
  }

  // hidden actors that never enter: make them enter at t=0
  for (const actor of actors) {
    if (actor.hidden && !beats.some((b) => b.do === "enter" && b.a === actor.id)) {
      actor.hidden = false;
    }
  }

  // ---- captions -----------------------------------------------------
  const captions: Caption[] = (Array.isArray(raw.captions) ? raw.captions : [])
    .filter((c) => c && typeof c === "object" && str(c.text))
    .map((c) => ({ t: clamp(num(c.t, 0), 0, MAX_DIAGRAM), text: str(c.text, 40) }))
    .sort((p, q) => p.t - q.t)
    .slice(0, 6);

  const definition = str(raw.definition, 60);
  let highlight = str(raw.highlight, 30);
  if (!highlight || !definition.includes(highlight)) highlight = "";

  return {
    hook: str(raw.hook, 40),
    term,
    definition,
    highlight,
    palette,
    actors,
    beats,
    captions,
    quiz: normalizeQuiz(raw.quiz, term),
  };
}
