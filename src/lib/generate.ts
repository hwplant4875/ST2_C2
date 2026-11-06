"use client";

import { ApiError, postStream } from "./api";
import { MAX_CHARS, buildOutlineRequest, extractFiles, fitRange, type Extracted } from "./extract";
import type { Card, Deck, Outline, Scene, SceneRequest } from "./schema";
import { newId, saveDeck } from "./storage";

export type JobPhase = "reading" | "range" | "outline" | "scenes" | "done" | "error";

export interface JobState {
  phase: JobPhase;
  message: string;
  progress: number; // 0..1
  fileName: string;
  found: string[];
  deck: Deck | null;
  ready: number;
  total: number;
  error?: string;
  errorCode?: string;
  range?: { from: number; to: number; maxPage: number; totalChars: number; maxChars: number };
}

export interface JobHandle {
  cancel: () => void;
  chooseRange: (r: { from: number; to: number }) => void;
  retryCard: (cardId: string) => Promise<void>;
}

const SCENE_CONCURRENCY = 3;

function findTerms(text: string): string[] {
  const out: string[] = [];
  const re = /"term"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    try {
      out.push(JSON.parse(`"${m[1]}"`));
    } catch {
      out.push(m[1]);
    }
  }
  return out;
}

export function startJob(files: File[], count: number, onUpdate: (s: JobState) => void): JobHandle {
  const ctrl = new AbortController();
  let state: JobState = {
    phase: "reading",
    message: "자료를 여는 중",
    progress: 0.02,
    fileName: files.map((f) => f.name).join(", "),
    found: [],
    deck: null,
    ready: 0,
    total: 0,
  };
  const set = (patch: Partial<JobState>) => {
    state = { ...state, ...patch };
    onUpdate(state);
  };
  let resolveRange: ((r: { from: number; to: number }) => void) | null = null;

  const sceneFor = async (deck: Deck, card: Card, index: number, onStarted?: () => void): Promise<Scene> => {
    const body: SceneRequest = {
      concept: card.concept,
      deck: { title: deck.title, subject: deck.subject, terms: deck.cards.map((c) => c.concept.term) },
      index,
      total: deck.cards.length,
    };
    return postStream<Scene>("/api/scene", body, { signal: ctrl.signal, onStatus: () => onStarted?.() });
  };

  const updateCard = (deck: Deck, id: string, patch: Partial<Card>) => {
    deck.cards = deck.cards.map((c) => (c.id === id ? { ...c, ...patch } : c));
    const ready = deck.cards.filter((c) => c.status === "ready").length;
    const settled = deck.cards.filter((c) => c.status !== "pending").length;
    saveDeck(deck);
    set({
      deck: { ...deck },
      ready,
      progress: 0.45 + 0.55 * (settled / Math.max(1, deck.cards.length)),
      message: `모션 만드는 중 ${ready} / ${deck.cards.length}`,
    });
  };

  const run = async () => {
    // 1) read files
    let ex: Extracted;
    ex = await extractFiles(files, (msg, ratio) => set({ message: msg, progress: 0.02 + 0.13 * ratio }));

    // 2) long material → ask for a page range
    let range: { from: number; to: number } | undefined;
    if (ex.totalChars > MAX_CHARS && ex.pdfPages > 1) {
      const suggestion = fitRange(ex, 1);
      set({
        phase: "range",
        message: "자료가 길어요. 만들 범위를 골라 주세요",
        range: { ...suggestion, maxPage: ex.pdfPages, totalChars: ex.totalChars, maxChars: MAX_CHARS },
      });
      range = await new Promise((resolve) => (resolveRange = resolve));
    }

    // 3) outline
    set({ phase: "outline", message: "핵심 개념을 찾는 중", progress: 0.16 });
    let acc = "";
    const outline = await postStream<Outline>("/api/outline", buildOutlineRequest(ex, count, range), {
      signal: ctrl.signal,
      onDelta: (t) => {
        acc += t;
        const found = findTerms(acc);
        if (found.length !== state.found.length) {
          set({ found, message: `핵심 개념 찾는 중 · ${found.length}개`, progress: Math.min(0.44, 0.18 + 0.26 * (found.length / count)) });
        }
      },
    });

    const deck: Deck = {
      id: newId(),
      title: outline.deckTitle || ex.name,
      subject: outline.subject || "",
      source: ex.name + (range ? ` (p.${range.from}–${range.to})` : ""),
      createdAt: Date.now(),
      cards: outline.concepts.map((c) => ({ id: newId(), concept: c, scene: null, status: "pending" as const })),
    };
    saveDeck(deck);
    set({
      phase: "scenes",
      deck: { ...deck },
      found: outline.concepts.map((c) => c.term),
      total: deck.cards.length,
      ready: 0,
      progress: 0.45,
      message: `모션 만드는 중 0 / ${deck.cards.length}`,
    });

    // 4) scenes, a few at a time (cards appear in the feed as soon as they are ready).
    // The first request goes alone; the others wait until it starts streaming so they
    // read the system-prompt cache it just wrote (cheaper, and easier on rate limits).
    let next = 0;
    let warmed: () => void = () => {};
    const warm = new Promise<void>((resolve) => {
      warmed = resolve;
      setTimeout(resolve, 25_000);
    });
    const worker = async (w: number) => {
      if (w > 0) await warm;
      while (next < deck.cards.length && !ctrl.signal.aborted) {
        const i = next++;
        const card = deck.cards[i];
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const scene = await sceneFor(deck, card, i, warmed);
            warmed();
            updateCard(deck, card.id, { scene, status: "ready", error: undefined });
            break;
          } catch (e) {
            warmed();
            if ((e as Error).name === "AbortError") return;
            const code = e instanceof ApiError ? e.code : "";
            if (attempt === 1 || code === "NO_KEY" || code === "AUTH" || code === "CREDIT") {
              updateCard(deck, card.id, { status: "error", error: (e as Error).message });
              break;
            }
            await new Promise((r) => setTimeout(r, 2500));
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SCENE_CONCURRENCY, deck.cards.length) }, (_, w) => worker(w)));
    const ready = deck.cards.filter((c) => c.status === "ready").length;
    if (ready === 0) {
      const firstErr = deck.cards.find((c) => c.error)?.error;
      throw new ApiError(firstErr || "모션을 만들지 못했어요. 다시 시도해 주세요.", "NO_SCENES");
    }
    set({ phase: "done", progress: 1, message: "완성!" });
  };

  run().catch((e) => {
    if ((e as Error).name === "AbortError" || ctrl.signal.aborted) return;
    set({ phase: "error", error: (e as Error).message || "알 수 없는 오류", errorCode: e instanceof ApiError ? e.code : "UNKNOWN" });
  });

  return {
    cancel: () => ctrl.abort(),
    chooseRange: (r) => {
      resolveRange?.(r);
      resolveRange = null;
    },
    retryCard: async (cardId: string) => {
      const deck = state.deck;
      if (!deck) return;
      const i = deck.cards.findIndex((c) => c.id === cardId);
      if (i < 0) return;
      updateCard(deck, cardId, { status: "pending", error: undefined });
      try {
        const scene = await sceneFor(deck, deck.cards[i], i);
        updateCard(deck, cardId, { scene, status: "ready" });
      } catch (e) {
        updateCard(deck, cardId, { status: "error", error: (e as Error).message });
      }
    },
  };
}

/** Regenerate a single card of a stored deck (used from the feed). */
export async function regenerateCard(deck: Deck, cardId: string): Promise<Scene> {
  const i = deck.cards.findIndex((c) => c.id === cardId);
  const card = deck.cards[i];
  return postStream<Scene>("/api/scene", {
    concept: card.concept,
    deck: { title: deck.title, subject: deck.subject, terms: deck.cards.map((c) => c.concept.term) },
    index: i,
    total: deck.cards.length,
  } satisfies SceneRequest);
}
