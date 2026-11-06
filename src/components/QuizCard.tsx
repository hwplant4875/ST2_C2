"use client";

import React, { useMemo } from "react";
import type { Quiz } from "@/lib/schema";
import { PALETTE_BG } from "@/motion/palettes";
import type { Palette } from "@/lib/schema";

interface Props {
  quiz: Quiz;
  term: string;
  palette: Palette;
  retry: boolean;
  selected: number | null;
  streak: number;
  onAnswer: (i: number) => void;
  onNext: () => void;
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: 50 + (Math.random() - 0.5) * 20,
        dx: (Math.random() - 0.5) * 340,
        dy: -120 - Math.random() * 260,
        rot: Math.random() * 720,
        color: ["#FFD43B", "#4B6BFB", "#22C55E", "#FF3D71", "#FF8A00"][i % 5],
        size: 8 + Math.random() * 8,
        delay: Math.random() * 0.08,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-[55%] block rounded-sm"
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size * 0.6,
              background: b.color,
              animation: `confetti-fly 1.1s cubic-bezier(.15,.7,.4,1) ${b.delay}s forwards`,
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
              "--rot": `${b.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <style>{`@keyframes confetti-fly{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 260px)) rotate(var(--rot));opacity:0}}`}</style>
    </div>
  );
}

export default function QuizCard({ quiz, term, palette, retry, selected, streak, onAnswer, onNext }: Props) {
  const pal = PALETTE_BG[palette] ?? PALETTE_BG.blue;
  const answered = selected !== null;
  const correct = answered && selected === quiz.answer;
  return (
    <div className="relative flex h-full w-full flex-col" style={{ background: `linear-gradient(180deg, ${pal.top}, ${pal.bottom})` }}>
      <div className="h-[118px] shrink-0" />
      <div className="relative mx-3 mb-[92px] flex flex-1 flex-col overflow-hidden rounded-[30px] bg-white px-5 pb-5 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[12.5px] font-extrabold text-[var(--blue)]">
            {retry ? "♻️ 다시 도전" : "🧩 퀴즈"} · {term}
          </span>
          {streak >= 2 ? (
            <span className="ml-auto rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF3D71] px-3 py-1 text-[12.5px] font-extrabold text-white shadow">
              🔥 {streak} 연속
            </span>
          ) : null}
        </div>
        <h2 className="mt-4 text-[21px] font-extrabold leading-[1.38] tracking-tight text-[var(--ink)]" style={{ wordBreak: "keep-all" }}>
          {quiz.question}
        </h2>
        <div className="mt-5 flex flex-col gap-2.5">
          {quiz.options.map((o, i) => {
            const isAns = i === quiz.answer;
            const isSel = i === selected;
            let cls = "border-[#E5E7EB] bg-white text-[var(--ink)]";
            if (answered && isAns) cls = "border-[#22C55E] bg-[#ECFDF5] text-[#15803D]";
            else if (answered && isSel) cls = "border-[#FF5A6A] bg-[#FFF1F2] text-[#BE123C] animate-shake-x";
            else if (answered) cls = "border-[#F1F2F4] bg-white text-[#9CA3AF]";
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => onAnswer(i)}
                className={`flex items-center gap-3 rounded-[18px] border-[2.5px] px-3.5 py-3 text-left text-[16px] font-bold transition-colors active:scale-[0.99] ${cls}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold ${
                    answered && isAns ? "bg-[#22C55E] text-white" : answered && isSel ? "bg-[#FF5A6A] text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                  }`}
                >
                  {answered && isAns ? "✓" : answered && isSel ? "✕" : i + 1}
                </span>
                <span style={{ wordBreak: "keep-all" }}>{o}</span>
              </button>
            );
          })}
        </div>
        {answered ? (
          <div className="animate-pop-in mt-auto pt-4">
            <div className={`rounded-[18px] px-4 py-3 ${correct ? "bg-[#ECFDF5]" : "bg-[#FFF7ED]"}`}>
              <p className={`font-jua text-[19px] ${correct ? "text-[#15803D]" : "text-[#C2410C]"}`}>{correct ? "정답! 👏" : "아쉬워요! 오답노트에 담았어요"}</p>
              {quiz.explanation ? <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#374151]">{quiz.explanation}</p> : null}
            </div>
            <button type="button" onClick={onNext} className="mt-3 w-full rounded-full bg-[var(--navy)] py-3 font-jua text-[18px] text-[var(--yellow)]">
              다음 개념 ↓
            </button>
          </div>
        ) : (
          <p className="mt-auto pt-4 text-center text-[12.5px] font-semibold text-[var(--muted)]">정답을 골라 보세요 · 넘기면 건너뛰기</p>
        )}
        {correct ? <Confetti /> : null}
      </div>
    </div>
  );
}
