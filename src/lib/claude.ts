import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];
export const effortFor = (kind: "outline" | "scene"): Effort => {
  const v = (kind === "outline" ? process.env.CLAUDE_EFFORT_OUTLINE : process.env.CLAUDE_EFFORT_SCENE) as Effort | undefined;
  if (v && EFFORTS.includes(v)) return v;
  return kind === "outline" ? "low" : "medium";
};

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 500,
  ) {
    super(message);
  }
}

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const isMock = () => process.env.MOCK_AI === "1" && !hasKey();

let client: Anthropic | null = null;
function getClient() {
  if (!hasKey()) {
    throw new AppError("서버에 Claude API 키가 아직 설정되지 않았어요. Vercel 환경변수 ANTHROPIC_API_KEY를 넣어 주세요.", "NO_KEY", 503);
  }
  client ??= new Anthropic({ maxRetries: 3, timeout: 280_000 });
  return client;
}

/** Map SDK errors to short Korean messages for the UI. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AppError("Claude API 키가 올바르지 않아요. Vercel 환경변수를 확인해 주세요.", "AUTH", 401);
  if (err instanceof Anthropic.PermissionDeniedError) return new AppError("이 API 키로는 해당 모델을 쓸 수 없어요.", "PERMISSION", 403);
  if (err instanceof Anthropic.RateLimitError)
    return new AppError("요청이 한꺼번에 몰렸어요. 잠시 후 다시 시도하거나 자료 범위를 줄여 주세요.", "RATE_LIMIT", 429);
  if (err instanceof Anthropic.BadRequestError) {
    const msg = String(err.message || "");
    if (/credit balance/i.test(msg)) return new AppError("Claude API 크레딧이 부족해요. console.anthropic.com에서 충전해 주세요.", "CREDIT", 402);
    if (/too long|too many tokens|prompt is too long/i.test(msg)) return new AppError("자료가 너무 길어요. 범위를 줄여서 다시 시도해 주세요.", "TOO_LONG", 413);
    return new AppError(`요청을 처리하지 못했어요: ${msg.slice(0, 160)}`, "BAD_REQUEST", 400);
  }
  if (err instanceof Anthropic.OverloadedError || err instanceof Anthropic.InternalServerError)
    return new AppError("Claude 서버가 잠시 혼잡해요. 조금 뒤 다시 시도해 주세요.", "OVERLOADED", 503);
  if (err instanceof Anthropic.APIConnectionError) return new AppError("Claude 서버에 연결하지 못했어요.", "CONNECTION", 502);
  if (err instanceof Anthropic.APIError) return new AppError(`Claude API 오류 (${err.status ?? "?"})`, "API", 500);
  return new AppError(err instanceof Error ? err.message : "알 수 없는 오류", "UNKNOWN", 500);
}

/**
 * Streams a structured-output JSON response from Claude.
 * onText receives raw JSON deltas (used for live progress in the UI).
 */
export async function streamJSON<S extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  effort: Effort;
  maxTokens: number;
  onText?: (delta: string) => void;
  /** Fires once, when the response starts streaming (the prompt cache entry is readable from then on). */
  onStart?: () => void;
  signal?: AbortSignal;
}): Promise<{ data: z.infer<S>; usage: Anthropic.Beta.BetaUsage }> {
  const anthropic = getClient();
  const stream = anthropic.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: opts.maxTokens,
      // Server-side refusal fallback (routes a declined request to Anthropic's recommended fallback model).
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.content }],
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    },
    { signal: opts.signal },
  );
  if (opts.onStart) {
    let started = false;
    stream.on("streamEvent", () => {
      if (started) return;
      started = true;
      opts.onStart!();
    });
  }
  if (opts.onText) stream.on("text", (delta) => opts.onText!(delta));
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") {
    throw new AppError("이 자료는 Claude가 처리를 거절했어요. 다른 자료로 시도해 주세요.", "REFUSAL", 422);
  }
  if (msg.stop_reason === "max_tokens") {
    throw new AppError("응답이 너무 길어져 중간에 끊겼어요. 개념 수를 줄여 다시 시도해 주세요.", "MAX_TOKENS", 500);
  }
  // Use text after the last fallback switch (if a fallback model took over mid-stream).
  let start = 0;
  msg.content.forEach((b, i) => {
    if (b.type === "fallback") start = i + 1;
  });
  const text = msg.content
    .slice(start)
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError("Claude 응답을 해석하지 못했어요. 다시 시도해 주세요.", "PARSE", 500);
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    // Structured outputs should prevent this; fall back to the raw object so normalizers can repair it.
    return { data: json as z.infer<S>, usage: msg.usage };
  }
  return { data: parsed.data, usage: msg.usage };
}

/* ------------------------------------------------------------------ */
/*  NDJSON streaming response helper                                   */
/* ------------------------------------------------------------------ */

export function ndjsonResponse(run: (send: (event: object) => void, signal: AbortSignal) => Promise<void>, req: Request): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      // keep-alive so proxies don't cut idle connections while Claude thinks
      const ping = setInterval(() => send({ type: "status", message: "" }), 10_000);
      try {
        await run(send, req.signal);
      } catch (err) {
        const e = toAppError(err);
        console.error("[studytok]", e.code, e.message, err);
        send({ type: "error", message: e.message, code: e.code });
      } finally {
        clearInterval(ping);
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export function jsonError(message: string, code: string, status: number) {
  return Response.json({ error: message, code }, { status });
}
