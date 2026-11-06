"use client";

import React, { useEffect, useState } from "react";
import type { JobState } from "@/lib/generate";

interface Props {
  job: JobState;
  onCancel: () => void;
  onOpenEarly: () => void;
  onChooseRange: (r: { from: number; to: number }) => void;
  onRetry: () => void;
  onSample: () => void;
}

const TIPS = [
  "개념마다 Claude가 장면을 직접 설계하고 있어요",
  "퀴즈는 몇 장마다 낼지 위쪽 버튼으로 바꿀 수 있어요",
  "틀린 문제는 잠시 뒤에 다시 나와요",
  "카드를 탭하면 멈추고, 위로 넘기면 다음 개념이에요",
  "만든 모션은 보관함에 저장돼요",
];

function Step({ state, label, detail }: { state: "done" | "doing" | "todo"; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[2.5px] ${
          state === "done" ? "border-white bg-white" : state === "doing" ? "border-white/90" : "border-white/35"
        }`}
      >
        {state === "done" ? (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke="#4B6BFB" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === "doing" ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2.5px] border-white border-t-transparent" />
        ) : null}
      </span>
      <span className={`text-[15px] font-bold ${state === "todo" ? "text-white/45" : "text-white"}`}>{label}</span>
      {detail ? <span className="ml-auto text-[13px] font-bold text-white/80">{detail}</span> : null}
    </div>
  );
}

function CardStack({ found }: { found: number }) {
  const emojis = ["📄", "✂️", "🎬", "🧩"];
  return (
    <div className="relative mx-auto h-[150px] w-[200px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 flex h-[130px] w-[92px] items-center justify-center rounded-[18px] border-[3px] border-[var(--navy)] bg-white text-[38px] shadow-[0_6px_0_var(--navy)]"
          style={
            {
              marginLeft: -46 + (i - 1) * 46,
              marginTop: -65,
              "--r": `${(i - 1) * 9}deg`,
              animation: `card-stack 1.8s ease-in-out ${i * 0.18}s infinite`,
              zIndex: i === 1 ? 2 : 1,
              background: i === 1 ? "#FFD43B" : "#fff",
            } as React.CSSProperties
          }
        >
          {emojis[(i + found) % emojis.length]}
        </div>
      ))}
    </div>
  );
}

export default function Loading({ job, onCancel, onOpenEarly, onChooseRange, onRetry, onSample }: Props) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 3500);
    return () => clearInterval(t);
  }, []);
  const [from, setFrom] = useState(job.range?.from ?? 1);
  const [to, setTo] = useState(job.range?.to ?? 1);
  useEffect(() => {
    if (job.range) {
      setFrom(job.range.from);
      setTo(job.range.to);
    }
  }, [job.range]);

  const phaseIdx = { reading: 0, range: 0, outline: 1, scenes: 2, done: 3, error: -1 }[job.phase];
  const st = (i: number): "done" | "doing" | "todo" => (phaseIdx > i ? "done" : phaseIdx === i ? "doing" : "todo");
  const canOpen = job.phase === "scenes" && job.ready >= 2;

  return (
    <div className="relative flex h-full flex-col overflow-hidden text-white" style={{ background: "linear-gradient(180deg,#4B6BFB 0%,#5B5CF6 55%,#6C4CF1 100%)" }}>
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-[#A78BFA]/40 blur-3xl" />

      <header className="relative z-10 flex items-center px-3 pt-[max(14px,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} aria-label="취소" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M4 4 L16 16 M16 4 L4 16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
        <span className="ml-1 max-w-[70%] truncate text-[13px] font-bold text-white/85">{job.fileName}</span>
      </header>

      {job.phase === "error" ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-7 text-center">
          <div className="animate-shake-x text-[54px]">😵</div>
          <h2 className="mt-3 font-jua text-[27px]">앗, 만들지 못했어요</h2>
          <p className="mt-2 text-[14.5px] font-semibold leading-relaxed text-white/90">{job.error}</p>
          <div className="mt-6 flex w-full flex-col gap-2.5">
            {job.errorCode !== "NO_KEY" ? (
              <button type="button" onClick={onRetry} className="rounded-full border-[3px] border-white bg-[var(--navy)] py-3 font-jua text-[19px] text-[var(--yellow)]">
                다시 시도
              </button>
            ) : null}
            <button type="button" onClick={onSample} className="rounded-full bg-white py-3 text-[15px] font-extrabold text-[var(--navy)]">
              예시 모션 보기
            </button>
            <button type="button" onClick={onCancel} className="py-2 text-[14px] font-bold text-white/85">
              홈으로
            </button>
          </div>
        </div>
      ) : job.phase === "range" && job.range ? (
        <div className="relative z-10 flex flex-1 flex-col justify-center px-6">
          <div className="text-center text-[46px]">📚</div>
          <h2 className="mt-2 text-center font-jua text-[26px] leading-tight">자료가 길어요!</h2>
          <p className="mt-2 text-center text-[14px] font-semibold leading-relaxed text-white/90">
            전체 {job.range.maxPage}쪽, 약 {job.range.totalChars.toLocaleString()}자예요.
            <br />한 번에 약 {job.range.maxChars.toLocaleString()}자까지 만들 수 있어요.
          </p>
          <div className="mt-5 rounded-[24px] bg-white p-4 text-[var(--ink)]">
            <p className="text-[13px] font-extrabold text-[var(--muted)]">만들 쪽 범위</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={job.range.maxPage}
                value={from}
                onChange={(e) => setFrom(Math.max(1, Math.min(job.range!.maxPage, Number(e.target.value) || 1)))}
                className="w-20 rounded-xl border-2 border-[#E5E7EB] px-3 py-2 text-center text-[17px] font-extrabold"
                aria-label="시작 쪽"
              />
              <span className="font-bold text-[var(--muted)]">쪽 ~</span>
              <input
                type="number"
                min={from}
                max={job.range.maxPage}
                value={to}
                onChange={(e) => setTo(Math.max(1, Math.min(job.range!.maxPage, Number(e.target.value) || 1)))}
                className="w-20 rounded-xl border-2 border-[#E5E7EB] px-3 py-2 text-center text-[17px] font-extrabold"
                aria-label="끝 쪽"
              />
              <span className="font-bold text-[var(--muted)]">쪽</span>
            </div>
            <p className="mt-2 text-[12px] font-semibold text-[var(--muted)]">추천 범위는 1~{job.range.to}쪽이에요. 나머지는 다시 올려서 만들 수 있어요.</p>
            <button
              type="button"
              onClick={() => onChooseRange({ from: Math.min(from, to), to: Math.max(from, to) })}
              className="mt-3 w-full rounded-full bg-[var(--navy)] py-3 font-jua text-[19px] text-[var(--yellow)]"
            >
              이 범위로 만들기
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col px-6">
          <div className="flex flex-1 flex-col items-center justify-center">
            <CardStack found={job.found.length} />
            <h2 className="mt-7 text-center font-jua text-[27px] leading-tight">{job.phase === "done" ? "완성!" : job.message}</h2>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/25">
              <div className="relative h-full rounded-full bg-[var(--yellow)] transition-[width] duration-500" style={{ width: `${Math.round(job.progress * 100)}%` }}>
                <div className="animate-shimmer absolute inset-0" />
              </div>
            </div>
            <p className="mt-3 min-h-[20px] text-center text-[13px] font-semibold text-white/80">{TIPS[tip]}</p>
          </div>

          <div className="mb-4 space-y-3 rounded-[24px] bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-sm">
            <Step state={st(0)} label="자료 읽기" />
            <Step state={st(1)} label="핵심 개념 찾기" detail={job.found.length ? `${job.found.length}개` : undefined} />
            <Step state={st(2)} label="개념별 모션 만들기" detail={job.total ? `${job.ready} / ${job.total}` : undefined} />
            {job.found.length ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {job.found.map((t, i) => {
                  const card = job.deck?.cards[i];
                  const status = card?.status;
                  return (
                    <span
                      key={`${t}${i}`}
                      className={`animate-pop-in rounded-full px-2.5 py-1 text-[12.5px] font-bold ${
                        status === "ready" ? "bg-white text-[var(--navy)]" : status === "error" ? "bg-[#FF5A6A] text-white" : "bg-white/20 text-white"
                      }`}
                    >
                      {status === "ready" ? "✓ " : ""}
                      {t}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="pb-[max(18px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!canOpen}
              onClick={onOpenEarly}
              className={`w-full rounded-full border-[3px] py-3.5 font-jua text-[20px] transition-all ${
                canOpen ? "border-white bg-[var(--yellow)] text-[var(--navy)] shadow-[0_5px_0_rgba(27,27,58,0.35)]" : "border-white/30 bg-white/10 text-white/50"
              }`}
            >
              {canOpen ? `준비된 ${job.ready}개부터 보기 →` : "모션이 준비되면 바로 볼 수 있어요"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
