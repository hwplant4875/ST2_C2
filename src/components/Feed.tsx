"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, Deck } from "@/lib/schema";
import type { Settings } from "@/lib/storage";
import { playSfx, setSoundEnabled, unlockAudio } from "@/lib/sfx";
import { bgCss } from "@/motion/palettes";
import { W } from "@/motion/timeline";
import QuizCard from "./QuizCard";
import SceneCard from "./SceneCard";
import { Sheet, Toast, useToast } from "./ui";

type Item =
  | { kind: "card"; key: string; card: Card }
  | { kind: "pending"; key: string; card: Card }
  | { kind: "quiz"; key: string; card: Card; retry: boolean }
  | { kind: "end"; key: string };

interface Props {
  deck: Deck;
  generating: boolean;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onBack: () => void;
  onDeckChange: (d: Deck) => void;
  onRetryCard: (cardId: string) => void;
}

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

function buildItems(deck: Deck, s: Settings, extras: { afterKey: string; cardId: string; n: number }[], showEnd: boolean): Item[] {
  const cards = s.shuffle ? seededShuffle(deck.cards, hash(deck.id)) : deck.cards;
  const items: Item[] = [];
  let window: Card[] = [];
  cards.forEach((card, i) => {
    if (card.status === "ready" && card.scene) {
      items.push({ kind: "card", key: `c-${card.id}`, card });
      window.push(card);
    } else items.push({ kind: "pending", key: `p-${card.id}`, card });
    if (s.quizEvery > 0 && (i + 1) % s.quizEvery === 0 && window.length) {
      const q = window[0]; // the earliest card of the block → spaced recall
      items.push({ kind: "quiz", key: `q-${q.id}`, card: q, retry: false });
      window = [];
    }
  });
  for (const ex of extras) {
    const card = deck.cards.find((c) => c.id === ex.cardId);
    if (!card?.scene) continue;
    const at = items.findIndex((it) => it.key === ex.afterKey);
    const item: Item = { kind: "quiz", key: `r-${ex.cardId}-${ex.n}`, card, retry: true };
    if (at >= 0) items.splice(at + 1, 0, item);
    else items.push(item);
  }
  if (showEnd) items.push({ kind: "end", key: "end" });
  return items;
}

const QUIZ_OPTIONS = [0, 1, 2, 3, 5];
const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function Feed({ deck, generating, settings, onSettings, onBack, onDeckChange, onRetryCard }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<{ afterKey: string; cardId: string; n: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [quizMenu, setQuizMenu] = useState(false);
  const [detail, setDetail] = useState<Card | null>(null);
  const [notes, setNotes] = useState(false);
  const [toast, setToast] = useToast();
  const progressBar = useRef<HTMLDivElement>(null);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  // measure the phone screen → composition height that fills it exactly
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const compHeight = Math.round(Math.min(2400, Math.max(1700, (W * size.h) / Math.max(1, size.w))));

  const allSettled = !generating && deck.cards.every((c) => c.status !== "pending");
  const items = useMemo(() => buildItems(deck, settings, extras, allSettled), [deck, settings, extras, allSettled]);
  const current = items[Math.min(index, items.length - 1)];
  const lastConceptBefore = useMemo(() => {
    let n = 0;
    for (let i = 0; i <= Math.min(index, items.length - 1); i++) if (items[i].kind === "card" || items[i].kind === "pending") n++;
    return n;
  }, [items, index]);

  const scrollTo = useCallback(
    (i: number) => {
      const el = scroller.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
    },
    [items.length],
  );

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    setIndex((prev) => {
      if (prev !== i) {
        if (progressBar.current) progressBar.current.style.width = "0%";
      }
      return i;
    });
  }, []);

  // keyboard navigation (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || notes) return;
      if (["ArrowDown", "PageDown", "j"].includes(e.key)) {
        e.preventDefault();
        scrollTo(index + 1);
      } else if (["ArrowUp", "PageUp", "k"].includes(e.key)) {
        e.preventDefault();
        scrollTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, scrollTo, detail, notes]);

  const set = (patch: Partial<Settings>, msg?: string) => {
    onSettings({ ...settings, ...patch });
    if (msg) setToast(msg);
    playSfx("tap");
  };

  const answer = (item: Extract<Item, { kind: "quiz" }>, i: number, at: number) => {
    unlockAudio();
    const quiz = item.card.scene!.quiz;
    setAnswers((a) => ({ ...a, [item.key]: i }));
    const ok = i === quiz.answer;
    playSfx(ok ? "correct" : "wrong");
    setStreak((s) => (ok ? s + 1 : 0));
    const wrong = new Set(deck.wrong ?? []);
    if (ok) {
      if (item.retry) wrong.delete(item.card.id);
    } else {
      wrong.add(item.card.id);
      if (settings.retryWrong) {
        const after = items[Math.min(at + 3, items.length - 1)];
        const afterKey = after?.kind === "end" ? items[items.length - 2]?.key : after?.key;
        if (afterKey) setExtras((x) => [...x, { afterKey, cardId: item.card.id, n: x.length + 1 }]);
      }
    }
    onDeckChange({ ...deck, wrong: [...wrong] });
  };

  const quizItems = items.filter((i) => i.kind === "quiz");
  const answered = quizItems.filter((i) => answers[i.key] !== undefined);
  const correctCount = answered.filter((i) => i.kind === "quiz" && answers[i.key] === i.card.scene!.quiz.answer).length;
  const wrongCards = deck.cards.filter((c) => deck.wrong?.includes(c.id) && c.scene);
  const readyCount = deck.cards.filter((c) => c.status === "ready").length;

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-[7px] text-[12.5px] font-extrabold backdrop-blur-md transition-colors ${
      active ? "bg-white text-[var(--navy)]" : "bg-black/25 text-white ring-1 ring-white/25"
    }`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* feed */}
      <div ref={scroller} onScroll={onScroll} className="snap-feed no-scrollbar h-full w-full overflow-y-scroll">
        {items.map((it, i) => {
          const dist = Math.abs(i - index);
          return (
            <section key={it.key} className="relative h-full w-full overflow-hidden" aria-label={it.kind === "card" ? it.card.concept.term : it.kind}>
              {it.kind === "card" ? (
                dist <= 1 ? (
                  <SceneCard
                    scene={it.card.scene!}
                    mode={dist === 0 ? "active" : "near"}
                    compHeight={compHeight}
                    speed={settings.speed}
                    sound={settings.sound}
                    captions={settings.captions}
                    autoNext={settings.autoNext}
                    onEnded={() => {
                      if (settings.autoNext && dist === 0) setTimeout(() => scrollTo(i + 1), 350);
                    }}
                    onProgress={(p) => {
                      if (progressBar.current && dist === 0) progressBar.current.style.width = `${Math.round(p * 1000) / 10}%`;
                    }}
                  />
                ) : (
                  <SceneCard
                    scene={it.card.scene!}
                    mode="far"
                    compHeight={compHeight}
                    speed={1}
                    sound={false}
                    captions={false}
                    autoNext={false}
                    onEnded={() => {}}
                  />
                )
              ) : it.kind === "pending" ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-8 text-center text-white" style={{ background: bgCss("navy") }}>
                  {it.card.status === "error" ? (
                    <>
                      <div className="text-[44px]">🛠️</div>
                      <p className="mt-3 font-jua text-[24px]">{it.card.concept.term}</p>
                      <p className="mt-2 text-[13.5px] font-semibold text-white/80">{it.card.error ?? "이 카드는 만들지 못했어요"}</p>
                      <button
                        type="button"
                        onClick={() => onRetryCard(it.card.id)}
                        className="mt-5 rounded-full border-[3px] border-white bg-[var(--yellow)] px-6 py-2.5 font-jua text-[18px] text-[var(--navy)]"
                      >
                        다시 만들기
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/30 border-t-[var(--yellow)]" />
                      <p className="mt-5 font-jua text-[26px]">{it.card.concept.term}</p>
                      <p className="mt-2 text-[14px] font-semibold text-white/80">모션을 만드는 중이에요…</p>
                    </>
                  )}
                </div>
              ) : it.kind === "quiz" ? (
                <QuizCard
                  quiz={it.card.scene!.quiz}
                  term={it.card.concept.term}
                  palette={it.card.scene!.palette}
                  retry={it.retry}
                  selected={answers[it.key] ?? null}
                  streak={streak}
                  onAnswer={(sel) => answer(it, sel, i)}
                  onNext={() => scrollTo(i + 1)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center px-7 text-center text-white" style={{ background: bgCss("blue") }}>
                  <div className="text-[56px]">🏁</div>
                  <h2 className="mt-2 font-jua text-[32px]">완주했어요!</h2>
                  <p className="mt-2 text-[14.5px] font-semibold text-white/85">{deck.title}</p>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2">
                    {[
                      { k: "개념", v: `${readyCount}개` },
                      { k: "퀴즈 정답", v: answered.length ? `${correctCount}/${answered.length}` : "-" },
                      { k: "오답노트", v: `${wrongCards.length}개` },
                    ].map((s) => (
                      <div key={s.k} className="rounded-[18px] bg-white/15 px-2 py-3 ring-1 ring-white/20">
                        <div className="font-jua text-[24px]">{s.v}</div>
                        <div className="text-[12px] font-bold text-white/80">{s.k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex w-full flex-col gap-2.5">
                    <button type="button" onClick={() => scrollTo(0)} className="rounded-full border-[3px] border-white bg-[var(--navy)] py-3 font-jua text-[19px] text-[var(--yellow)]">
                      처음부터 다시 보기
                    </button>
                    {wrongCards.length ? (
                      <button type="button" onClick={() => setNotes(true)} className="rounded-full bg-white py-3 text-[15px] font-extrabold text-[var(--navy)]">
                        📒 오답노트 복습
                      </button>
                    ) : null}
                    <button type="button" onClick={onBack} className="py-2 text-[14px] font-bold text-white/85">
                      홈으로
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {items.length === 0 ? (
          <section className="flex h-full w-full items-center justify-center text-white" style={{ background: bgCss("navy") }}>
            <p className="font-jua text-[22px]">모션을 준비하는 중…</p>
          </section>
        ) : null}
      </div>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/35 via-black/10 to-transparent pb-6 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-1 px-2">
          <button type="button" onClick={onBack} aria-label="홈으로" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 22 22">
              <path d="M14 4 L7 11 L14 18" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-white drop-shadow">{deck.title}</span>
          <span className="mr-2 rounded-full bg-black/25 px-2.5 py-1 text-[12px] font-extrabold text-white ring-1 ring-white/20">
            {Math.max(1, lastConceptBefore)} / {deck.cards.length}
            {generating ? " · 만드는 중" : ""}
          </span>
        </div>
        <div
          className="no-scrollbar pointer-events-auto mt-1.5 flex gap-1.5 overflow-x-auto pb-1 pl-3 pr-10"
          style={{ maskImage: "linear-gradient(90deg,#000 calc(100% - 36px),transparent)", WebkitMaskImage: "linear-gradient(90deg,#000 calc(100% - 36px),transparent)" }}
        >
          <button type="button" className={chip(settings.quizEvery > 0)} onClick={() => setQuizMenu((v) => !v)} aria-expanded={quizMenu}>
            🧩 {settings.quizEvery > 0 ? `퀴즈 ${settings.quizEvery}장마다` : "퀴즈 끔"} ▾
          </button>
          <button
            type="button"
            className={chip(settings.speed !== 1)}
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(settings.speed) + 1) % SPEEDS.length] ?? 1;
              set({ speed: next }, `재생 속도 ${next}배`);
            }}
          >
            ⏩ {settings.speed}x
          </button>
          <button
            type="button"
            className={chip(settings.sound)}
            onClick={() => {
              unlockAudio();
              set({ sound: !settings.sound }, settings.sound ? "효과음 끔" : "효과음 켬");
            }}
            aria-pressed={settings.sound}
          >
            {settings.sound ? "🔊 소리" : "🔇 소리"}
          </button>
          <button type="button" className={chip(settings.autoNext)} onClick={() => set({ autoNext: !settings.autoNext }, settings.autoNext ? "한 카드 반복 재생" : "다 보면 자동으로 다음 카드")}>
            {settings.autoNext ? "⏭ 자동 넘김" : "🔁 반복"}
          </button>
          <button type="button" className={chip(settings.captions)} onClick={() => set({ captions: !settings.captions }, settings.captions ? "자막 끔" : "자막 켬")} aria-pressed={settings.captions}>
            💬 자막
          </button>
          <button type="button" className={chip(settings.shuffle)} onClick={() => set({ shuffle: !settings.shuffle }, settings.shuffle ? "원래 순서" : "순서 섞기")} aria-pressed={settings.shuffle}>
            🔀 섞기
          </button>
          <button
            type="button"
            className={chip(settings.retryWrong)}
            onClick={() => set({ retryWrong: !settings.retryWrong }, settings.retryWrong ? "틀린 문제 다시 안 내기" : "틀린 문제는 3장 뒤 다시")}
            aria-pressed={settings.retryWrong}
          >
            ♻️ 오답 재출제
          </button>
          <button type="button" className={chip(false)} onClick={() => setNotes(true)}>
            📒 오답노트 {wrongCards.length ? wrongCards.length : ""}
          </button>
        </div>
        {quizMenu ? (
          <div className="pointer-events-auto absolute left-3 top-[calc(100%-14px)] z-30 w-[230px] rounded-[20px] bg-white p-2 shadow-xl ring-1 ring-black/5">
            <p className="px-2 pb-1 pt-1 text-[12px] font-extrabold text-[var(--muted)]">퀴즈를 몇 장마다 낼까요?</p>
            {QUIZ_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  set({ quizEvery: n }, n ? `개념 ${n}장마다 퀴즈` : "퀴즈 끔");
                  setQuizMenu(false);
                }}
                className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-[14.5px] font-bold ${
                  settings.quizEvery === n ? "bg-[#EEF2FF] text-[var(--blue)]" : "text-[var(--ink)]"
                }`}
              >
                {n === 0 ? "퀴즈 없이 보기" : n === 1 ? "매 장마다" : `${n}장마다`}
                {settings.quizEvery === n ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* bottom bar */}
      {current?.kind === "card" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/30 to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-8">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetail(current.card)}
              className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold text-[var(--navy)] shadow-lg"
            >
              📖 해설 보기
            </button>
            {current.card.concept.pages ? (
              <span className="rounded-full bg-black/25 px-2.5 py-1.5 text-[12px] font-bold text-white ring-1 ring-white/20">{current.card.concept.pages}</span>
            ) : null}
            {index === 0 ? <span className="animate-bob ml-auto text-[12.5px] font-extrabold text-white drop-shadow">↑ 올려서 다음</span> : null}
          </div>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/25">
            <div ref={progressBar} className="h-full w-0 rounded-full bg-white" />
          </div>
        </div>
      ) : null}

      <Toast text={toast} />

      {/* explanation sheet */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.concept.term}>
        {detail ? (
          <div className="space-y-4 pb-2">
            <p className="rounded-[16px] bg-[#FFF8DB] px-4 py-3 text-[15px] font-bold leading-relaxed text-[var(--navy)]">{detail.concept.definition}</p>
            <p className="text-[14.5px] font-medium leading-[1.7] text-[#374151]">{detail.concept.explanation}</p>
            {detail.concept.keyPoints.length ? (
              <div>
                <p className="mb-1.5 text-[12.5px] font-extrabold text-[var(--muted)]">시험 포인트</p>
                <ul className="space-y-1.5">
                  {detail.concept.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2 text-[14px] font-semibold leading-relaxed text-[var(--ink)]">
                      <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-[11px] font-extrabold text-[var(--yellow)]">{i + 1}</span>
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detail.concept.example ? (
              <div className="rounded-[16px] bg-[#F3F5FB] px-4 py-3">
                <p className="text-[12.5px] font-extrabold text-[var(--muted)]">예시</p>
                <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#374151]">{detail.concept.example}</p>
              </div>
            ) : null}
            <p className="text-[12px] font-semibold text-[var(--muted)]">
              출처: {deck.source}
              {detail.concept.pages ? ` · ${detail.concept.pages}` : ""} · AI가 만든 설명이라 원문과 함께 확인하세요.
            </p>
            {!deck.sample ? (
              <button
                type="button"
                onClick={() => {
                  onRetryCard(detail.id);
                  setDetail(null);
                  setToast("이 카드 모션을 새로 만들어요");
                }}
                className="w-full rounded-full bg-[#F3F4F6] py-3 text-[14px] font-extrabold text-[var(--ink)]"
              >
                🎲 이 카드 모션 다시 만들기
              </button>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {/* wrong-answer notes */}
      <Sheet open={notes} onClose={() => setNotes(false)} title={`📒 오답노트 ${wrongCards.length}개`}>
        {wrongCards.length === 0 ? (
          <p className="py-6 text-center text-[14px] font-semibold text-[var(--muted)]">아직 틀린 문제가 없어요. 좋아요! 👍</p>
        ) : (
          <div className="space-y-3 pb-2">
            {wrongCards.map((c) => (
              <div key={c.id} className="rounded-[18px] border-2 border-[#F1F2F6] p-4">
                <p className="text-[12.5px] font-extrabold text-[var(--blue)]">{c.concept.term}</p>
                <p className="mt-1 text-[14.5px] font-bold leading-snug text-[var(--ink)]">{c.scene!.quiz.question}</p>
                <p className="mt-2 text-[14px] font-extrabold text-[#15803D]">✓ {c.scene!.quiz.options[c.scene!.quiz.answer]}</p>
                {c.scene!.quiz.explanation ? <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#4B5563]">{c.scene!.quiz.explanation}</p> : null}
                <button
                  type="button"
                  onClick={() => {
                    const at = items.findIndex((it) => it.kind === "card" && it.card.id === c.id);
                    setNotes(false);
                    if (at >= 0) setTimeout(() => scrollTo(at), 260);
                  }}
                  className="mt-2 text-[13px] font-extrabold text-[var(--blue)]"
                >
                  카드 다시 보기 →
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
