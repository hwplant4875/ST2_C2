import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  StudyTok Motion DSL                                                 */
/*  Claude writes a scene in this format; src/motion renders it.        */
/*  Every field is required (structured outputs friendly); unused       */
/*  fields are filled with "" or 0.                                     */
/* ------------------------------------------------------------------ */

export const PALETTES = ["blue", "violet", "green", "teal", "orange", "pink", "navy", "red"] as const;
export const ACTOR_TYPES = ["card", "circle", "emoji", "pill", "text", "number", "bar", "zone"] as const;
export const ACTIONS = [
  "enter",
  "exit",
  "move",
  "send",
  "link",
  "pulse",
  "glow",
  "shake",
  "swap",
  "count",
  "grow",
  "mark",
  "dim",
  "burst",
] as const;
export const COLORS = ["white", "yellow", "blue", "green", "red", "purple", "orange", "navy"] as const;
export const SIZES = ["s", "m", "l"] as const;
export const STYLES = [
  "",
  // enter
  "pop",
  "left",
  "right",
  "up",
  "down",
  "fade",
  "drop",
  // send
  "bubble",
  "answer",
  "token",
  "pill",
  // link
  "arrow",
  "line",
  "flow",
  "both",
  // mark
  "check",
  "cross",
  // dim
  "on",
  "off",
] as const;

export const ActorSchema = z.object({
  id: z.string().describe("short unique id, e.g. 'app', 'server'"),
  type: z.enum(ACTOR_TYPES),
  emoji: z.string().describe("one emoji for card/circle/emoji types, else ''"),
  label: z.string().describe("short label (≤ 10 chars). For pill/text it is the text itself; for number it is the unit suffix"),
  x: z.number().describe("center x on the stage, 0 (left) – 100 (right)"),
  y: z.number().describe("center y on the stage, 0 (top) – 100 (bottom). For bar: the baseline (bottom)"),
  w: z.number().describe("zone width in stage units (zone only, else 0)"),
  h: z.number().describe("zone height / bar max height in stage units (else 0)"),
  size: z.enum(SIZES),
  color: z.enum(COLORS),
  value: z.number().describe("number: start value; bar: start fill 0–100; else 0"),
  hidden: z.boolean().describe("true = invisible until an 'enter' beat"),
});

export const BeatSchema = z.object({
  t: z.number().describe("start time in seconds from the start of the diagram phase"),
  do: z.enum(ACTIONS),
  a: z.string().describe("main actor id (for send/link: the source)"),
  b: z.string().describe("second actor id (send/link target; enter: spawn-from actor) or ''"),
  x: z.number().describe("move target x (move only, else 0)"),
  y: z.number().describe("move target y (move only, else 0)"),
  text: z.string().describe("bubble text / link label / new label for swap, else ''"),
  emoji: z.string().describe("token emoji for send, new emoji for swap, else ''"),
  value: z.number().describe("count/grow target value, else 0"),
  style: z.enum(STYLES),
  d: z.number().describe("duration in seconds (0 = default)"),
  id: z.string().describe("link id so it can be removed later with exit, else ''"),
});

export const CaptionSchema = z.object({
  t: z.number().describe("seconds from the start of the diagram phase"),
  text: z.string(),
});

export const QuizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).describe("exactly 4 options"),
  answer: z.number().int().describe("index 0–3 of the correct option"),
  explanation: z.string(),
});

export const SceneSchema = z.object({
  hook: z.string().describe("curiosity question shown first, ≤ 20 chars"),
  term: z.string(),
  definition: z.string().describe("plain one-line definition, ≤ 28 chars"),
  highlight: z.string().describe("key phrase that appears verbatim inside definition"),
  palette: z.enum(PALETTES),
  actors: z.array(ActorSchema),
  beats: z.array(BeatSchema),
  captions: z.array(CaptionSchema),
  quiz: QuizSchema,
});

/* ------------------------------------------------------------------ */
/*  Outline (concept extraction)                                       */
/* ------------------------------------------------------------------ */

export const ConceptSchema = z.object({
  term: z.string(),
  definition: z.string(),
  explanation: z.string(),
  keyPoints: z.array(z.string()),
  example: z.string(),
  visual: z.string(),
  pages: z.string(),
});

export const OutlineSchema = z.object({
  deckTitle: z.string(),
  subject: z.string(),
  language: z.string(),
  concepts: z.array(ConceptSchema),
});

export type Palette = (typeof PALETTES)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];
export type Action = (typeof ACTIONS)[number];
export type ActorColor = (typeof COLORS)[number];
export type Size = (typeof SIZES)[number];
export type Style = (typeof STYLES)[number];
export type Actor = z.infer<typeof ActorSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Outline = z.infer<typeof OutlineSchema>;

/* ------------------------------------------------------------------ */
/*  App-level types (stored in the browser)                            */
/* ------------------------------------------------------------------ */

export type CardStatus = "pending" | "ready" | "error";

export interface Card {
  id: string;
  concept: Concept;
  scene: Scene | null;
  status: CardStatus;
  error?: string;
}

export interface Deck {
  id: string;
  title: string;
  subject: string;
  source: string;
  createdAt: number;
  cards: Card[];
  sample?: boolean;
  wrong?: string[]; // card ids answered wrong (오답노트)
}

/** Request bodies */
export interface OutlineRequest {
  name: string;
  pages: { n: number; text: string }[];
  images: { n: number; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
  count: number;
}

export interface SceneRequest {
  concept: Concept;
  deck: { title: string; subject: string; terms: string[] };
  index: number;
  total: number;
}

/** NDJSON stream events from the API routes */
export type StreamEvent<T> =
  | { type: "delta"; text: string }
  | { type: "status"; message: string }
  | { type: "done"; data: T }
  | { type: "error"; message: string; code?: string };
