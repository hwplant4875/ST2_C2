"use client";

import type { StreamEvent } from "./schema";

export class ApiError extends Error {
  constructor(
    message: string,
    public code = "UNKNOWN",
  ) {
    super(message);
  }
}

/** POSTs JSON and consumes an NDJSON event stream. Resolves with the `done` payload. */
export async function postStream<T>(
  url: string,
  body: unknown,
  handlers: { onDelta?: (text: string) => void; onStatus?: (msg: string) => void; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", "NETWORK");
  }
  if (!res.ok || !res.body) {
    let msg = `서버 오류 (${res.status})`;
    let code = "HTTP";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
      if (j?.code) code = j.code;
    } catch {}
    if (res.status === 413) msg = "자료가 너무 커요. 쪽 범위를 줄여 주세요.";
    throw new ApiError(msg, code);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: T | undefined;
  let error: ApiError | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev: StreamEvent<T>;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === "delta") handlers.onDelta?.(ev.text);
      else if (ev.type === "status") ev.message && handlers.onStatus?.(ev.message);
      else if (ev.type === "done") result = ev.data;
      else if (ev.type === "error") error = new ApiError(ev.message, ev.code);
    }
  }
  if (error) throw error;
  if (result === undefined) throw new ApiError("응답이 중간에 끊겼어요. 다시 시도해 주세요.", "INCOMPLETE");
  return result;
}

export async function getHealth(): Promise<{ hasKey: boolean; mock: boolean; model: string } | null> {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
