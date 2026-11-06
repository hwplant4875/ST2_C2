import type Anthropic from "@anthropic-ai/sdk";
import { AppError, effortFor, hasKey, isMock, jsonError, ndjsonResponse, streamJSON } from "@/lib/claude";
import { OUTLINE_SYSTEM } from "@/lib/prompts";
import { OutlineSchema, type Outline, type OutlineRequest } from "@/lib/schema";
import { SAMPLE_DECK } from "@/lib/samples";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_BODY = 4_400_000;

function escapeAttr(s: string) {
  return s.replace(/[<>"&]/g, " ").slice(0, 120);
}

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return jsonError("파일이 너무 커요. 쪽 범위를 줄여 주세요.", "TOO_LARGE", 413);
  if (!hasKey() && !isMock()) {
    return jsonError("서버에 Claude API 키가 아직 설정되지 않았어요. Vercel 환경변수 ANTHROPIC_API_KEY를 넣어 주세요.", "NO_KEY", 503);
  }

  let body: OutlineRequest;
  try {
    body = (await req.json()) as OutlineRequest;
  } catch {
    return jsonError("요청을 읽지 못했어요.", "BAD_BODY", 400);
  }
  const pages = Array.isArray(body.pages) ? body.pages.slice(0, 400) : [];
  const images = Array.isArray(body.images) ? body.images.slice(0, 16) : [];
  const count = Math.min(15, Math.max(3, Math.round(Number(body.count) || 8)));
  const name = escapeAttr(String(body.name || "자료"));
  if (!pages.some((p) => p?.text?.trim()) && images.length === 0) {
    return jsonError("자료에서 읽을 수 있는 내용이 없어요.", "EMPTY", 400);
  }

  return ndjsonResponse(async (send, signal) => {
    send({ type: "status", message: "자료를 읽는 중" });

    if (isMock()) {
      // Local UI testing without an API key: replay sample concepts slowly.
      const outline: Outline = {
        deckTitle: "모의 테스트 덱",
        subject: "예시",
        language: "ko",
        concepts: SAMPLE_DECK.cards.slice(0, Math.min(count, SAMPLE_DECK.cards.length)).map((c) => c.concept),
      };
      const text = JSON.stringify(outline);
      for (let i = 0; i < text.length; i += 60) {
        send({ type: "delta", text: text.slice(i, i + 60) });
        await new Promise((r) => setTimeout(r, 25));
      }
      send({ type: "done", data: outline });
      return;
    }

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const img of images) {
      if (!img?.data || !["image/jpeg", "image/png", "image/webp"].includes(img.media_type)) continue;
      content.push({ type: "text", text: img.n > 0 ? `[p.${img.n} 페이지 이미지]` : "[업로드한 사진]" });
      content.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
    }
    const pageText = pages
      .filter((p) => p?.text?.trim())
      .map((p) => `<page n="${Number(p.n) || 0}">\n${String(p.text).slice(0, 20000)}\n</page>`)
      .join("\n");
    content.push({
      type: "text",
      text: [
        `<material name="${name}">`,
        pageText || "(텍스트 없음: 위 이미지들을 읽어 주세요)",
        "</material>",
        "",
        `이 자료에서 시험에 꼭 필요한 핵심 개념 ${count}개를 학습 순서대로 뽑아 주세요.`,
      ].join("\n"),
    });

    const { data } = await streamJSON({
      system: OUTLINE_SYSTEM,
      content,
      schema: OutlineSchema,
      effort: effortFor("outline"),
      maxTokens: 16000,
      onText: (delta) => send({ type: "delta", text: delta }),
      signal,
    });
    const outline = data as Outline;
    const concepts = (outline.concepts ?? []).filter((c) => c?.term?.trim()).slice(0, count);
    if (concepts.length === 0) throw new AppError("자료에서 학습할 개념을 찾지 못했어요. 다른 자료로 시도해 주세요.", "NO_CONCEPTS", 422);
    send({
      type: "done",
      data: {
        deckTitle: String(outline.deckTitle || name).slice(0, 40),
        subject: String(outline.subject || "").slice(0, 30),
        language: String(outline.language || "ko").slice(0, 10),
        concepts: concepts.map((c) => ({
          term: String(c.term).slice(0, 40),
          definition: String(c.definition ?? "").slice(0, 120),
          explanation: String(c.explanation ?? "").slice(0, 800),
          keyPoints: (Array.isArray(c.keyPoints) ? c.keyPoints : []).map((k) => String(k).slice(0, 160)).slice(0, 5),
          example: String(c.example ?? "").slice(0, 300),
          visual: String(c.visual ?? "").slice(0, 300),
          pages: String(c.pages ?? "").slice(0, 30),
        })),
      },
    });
  }, req);
}
