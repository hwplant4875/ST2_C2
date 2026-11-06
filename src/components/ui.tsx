"use client";

import React, { useEffect, useState } from "react";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[var(--bg)] sm:p-4">
      <div
        className="relative h-full w-full overflow-hidden bg-[var(--page)] sm:h-[min(900px,calc(100dvh-32px))] sm:w-auto sm:rounded-[46px] sm:border-[10px] sm:border-[#0f1020] sm:shadow-[0_30px_80px_rgba(15,16,32,0.35)]"
        style={{ aspectRatio: "auto" }}
      >
        <div className="phone-aspect relative h-full w-full sm:aspect-[9/19.5]">{children}</div>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!mounted) return null;
  return (
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="닫기"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[82%] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.2)] transition-transform duration-250 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200" />
        {title ? <h2 className="mb-3 text-[19px] font-extrabold tracking-tight text-[var(--ink)]">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string | null }) {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-[110px] z-40 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ${
        text ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {text}
    </div>
  );
}

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), 1400);
    return () => clearTimeout(t);
  }, [text]);
  return [text, setText] as const;
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[30%] border-[3px] border-[var(--navy)] shadow-[0_3px_0_var(--navy)]"
      style={{ width: size, height: size, background: "linear-gradient(160deg,#4B6BFB,#6C4CF1)" }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 20 20" aria-hidden>
        <path d="M6 4.5 L15.5 10 L6 15.5 Z" fill="#FFD43B" stroke="#1B1B3A" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export const APP_NAME = "StudyTok";
