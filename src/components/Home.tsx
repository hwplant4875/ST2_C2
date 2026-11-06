"use client";

import React, { useRef, useState } from "react";
import { isImage, isPdf } from "@/lib/extract";
import { APP_NAME, Logo } from "./ui";

interface Props {
  deckCount: number;
  cardCount: number;
  onCardCount: (n: number) => void;
  onFiles: (files: File[]) => void;
  onLibrary: () => void;
  onSample: () => void;
  apiReady: boolean | null;
}

export default function Home({ deckCount, cardCount, onCardCount, onFiles, onLibrary, onSample, apiReady }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const bad = files.find((f) => !isPdf(f) && !isImage(f));
    if (bad) {
      setErr(`${bad.name}: PDF, JPG, PNG만 올릴 수 있어요`);
      return;
    }
    if (files.filter(isPdf).length > 1 || (files.some(isPdf) && files.some(isImage))) {
      setErr("PDF는 한 번에 1개씩, 사진은 여러 장을 함께 올릴 수 있어요");
      return;
    }
    setErr(null);
    onFiles(files);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--page)]">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#4B6BFB]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-60 w-60 rounded-full bg-[#FFD43B]/30 blur-3xl" />

      <header className="relative z-10 flex items-center gap-2.5 px-5 pt-[max(18px,env(safe-area-inset-top))]">
        <Logo size={34} />
        <span className="font-jua text-[24px] leading-none text-[var(--navy)]">{APP_NAME}</span>
        <span className="ml-auto rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] shadow-sm">
          {apiReady === false ? "데모 모드" : "Beta"}
        </span>
      </header>

      <div className="relative z-10 px-6 pt-7">
        <h1 className="font-jua text-[33px] leading-[1.18] text-[var(--navy)]">
          자료만 올리면
          <br />
          <span className="relative inline-block">
            <span className="absolute inset-x-[-4px] bottom-[3px] h-[14px] rounded-md bg-[var(--yellow)]" />
            <span className="relative">숏폼 강의</span>
          </span>{" "}
          완성
        </h1>
        <p className="mt-2 text-[14.5px] font-medium leading-relaxed text-[var(--muted)]">
          개념마다 움직이는 설명 영상과 퀴즈로 바꿔 드려요.
        </p>
      </div>

      {/* drop zone */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            accept(e.dataTransfer.files);
          }}
          className={`group relative flex w-full flex-col items-center rounded-[30px] border-[2.5px] border-dashed px-5 pb-6 pt-7 text-center transition-all ${
            drag ? "scale-[1.02] border-[var(--blue)] bg-[#EEF2FF]" : "border-[#C9D1F6] bg-white"
          } shadow-[0_14px_40px_rgba(75,107,251,0.14)] active:scale-[0.99]`}
          aria-label="학습 자료 파일 올리기"
        >
          {/* illustration: document → motion card */}
          <div className="relative mb-5 h-[118px] w-[210px]" aria-hidden>
            <div className="absolute left-[8px] top-[14px] h-[96px] w-[74px] -rotate-6 rounded-[14px] border-[3px] border-[var(--navy)] bg-white shadow-[0_5px_0_var(--navy)]">
              <div className="mx-auto mt-3 h-[7px] w-[44px] rounded bg-[#DCE3FF]" />
              <div className="mx-auto mt-2 h-[7px] w-[52px] rounded bg-[#E8ECF8]" />
              <div className="mx-auto mt-2 h-[7px] w-[36px] rounded bg-[#E8ECF8]" />
              <div className="mx-auto mt-2 h-[7px] w-[48px] rounded bg-[#E8ECF8]" />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-md border-2 border-[var(--navy)] bg-[#FF5A5F] px-1.5 text-[10px] font-extrabold text-white">
                PDF
              </div>
            </div>
            <svg className="absolute left-[92px] top-[48px]" width="34" height="24" viewBox="0 0 34 24">
              <path d="M2 12 H26 M19 4 L28 12 L19 20" stroke="#1B1B3A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div
              className="animate-floaty absolute right-[6px] top-0 flex h-[118px] w-[70px] flex-col items-center justify-center rounded-[16px] border-[3px] border-[var(--navy)] shadow-[0_5px_0_var(--navy)]"
              style={{ background: "linear-gradient(180deg,#4B6BFB,#6C4CF1)" }}
            >
              <div className="text-[26px] leading-none">☀️</div>
              <div className="mt-1.5 rounded-full border-2 border-white bg-[var(--navy)] px-1.5 font-jua text-[11px] text-[var(--yellow)]">API</div>
              <div className="mt-1.5 font-jua text-[9px] text-white/90">약속된 통로</div>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border-[3px] border-white bg-[var(--navy)] px-6 py-3 font-jua text-[21px] text-[var(--yellow)] shadow-[0_5px_0_rgba(27,27,58,0.35)] transition-transform group-active:translate-y-[2px]">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M10 15 V4 M5 8.5 L10 3.5 L15 8.5" stroke="#FFD43B" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 15.5 V16.5 H16.5 V15.5" stroke="#FFD43B" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            자료 올리기
          </span>
          <span className="mt-3 text-[13px] font-semibold text-[var(--muted)]">
            {drag ? "여기에 놓으세요" : "강의 PDF · 교재 사진 · 필기 사진"}
          </span>
          <span className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            {["PDF", "JPG", "PNG", "여러 장 OK"].map((t) => (
              <span key={t} className="rounded-full bg-[#F1F3FA] px-2.5 py-1 text-[11.5px] font-bold text-[#5B6478]">
                {t}
              </span>
            ))}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic"
          multiple
          className="hidden"
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
        {err ? <p className="mt-3 text-center text-[13px] font-semibold text-[#E03E3E]">{err}</p> : null}

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-[13px] font-bold text-[var(--muted)]">만들 개념 수</span>
          <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
            {[6, 8, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCardCount(n)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-colors ${
                  cardCount === n ? "bg-[var(--navy)] text-[var(--yellow)]" : "text-[#5B6478]"
                }`}
                aria-pressed={cardCount === n}
              >
                {n}개
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* library */}
      <div className="relative z-10 px-5 pb-[max(18px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onLibrary}
          className="flex w-full items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_8px_24px_rgba(27,27,58,0.08)] ring-1 ring-black/5 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] text-[22px]" style={{ background: "linear-gradient(160deg,#FFE27A,#FFD43B)" }}>
            🎞️
          </span>
          <span className="flex-1">
            <span className="block text-[15.5px] font-extrabold text-[var(--ink)]">내 모션 보관함</span>
            <span className="block text-[12.5px] font-semibold text-[var(--muted)]">
              {deckCount > 0 ? `지금까지 만든 ${deckCount}개 세트 다시 보기` : "만든 모션이 여기에 모여요"}
            </span>
          </span>
          {deckCount > 0 ? (
            <span className="rounded-full bg-[var(--navy)] px-2.5 py-1 text-[12px] font-extrabold text-[var(--yellow)]">{deckCount}</span>
          ) : null}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M7 4 L12 9 L7 14" stroke="#9AA3B5" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" onClick={onSample} className="mx-auto mt-3 block text-[13px] font-bold text-[var(--blue)] underline-offset-4 hover:underline">
          자료 없이 예시부터 볼래요 →
        </button>
      </div>
    </div>
  );
}
