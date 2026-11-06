import { effortFor, hasKey, isMock, jsonError, ndjsonResponse, streamJSON } from "@/lib/claude";
import { normalizeScene } from "@/lib/normalize";
import { SCENE_SYSTEM, sceneUserPrompt } from "@/lib/prompts";
import { SAMPLE_SCENES } from "@/lib/samples";
import { SceneSchema, type Scene, type SceneRequest } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasKey() && !isMock()) {
    return jsonError("서버에 Claude API 키가 아직 설정되지 않았어요. Vercel 환경변수 ANTHROPIC_API_KEY를 넣어 주세요.", "NO_KEY", 503);
  }
  let body: SceneRequest;
  try {
    body = (await req.json()) as SceneRequest;
  } catch {
    return jsonError("요청을 읽지 못했어요.", "BAD_BODY", 400);
  }
  const c = body?.concept;
  if (!c?.term) return jsonError("개념 정보가 없어요.", "BAD_BODY", 400);
  const concept = {
    term: String(c.term).slice(0, 40),
    definition: String(c.definition ?? "").slice(0, 120),
    explanation: String(c.explanation ?? "").slice(0, 800),
    keyPoints: (Array.isArray(c.keyPoints) ? c.keyPoints : []).map((k) => String(k).slice(0, 160)).slice(0, 5),
    example: String(c.example ?? "").slice(0, 300),
    visual: String(c.visual ?? "").slice(0, 300),
    pages: String(c.pages ?? "").slice(0, 30),
  };
  const deck = {
    title: String(body.deck?.title ?? "").slice(0, 40),
    subject: String(body.deck?.subject ?? "").slice(0, 30),
    terms: (Array.isArray(body.deck?.terms) ? body.deck.terms : []).map((t) => String(t).slice(0, 40)).slice(0, 20),
  };
  const index = Math.max(0, Number(body.index) || 0);
  const total = Math.max(1, Number(body.total) || 1);

  return ndjsonResponse(async (send, signal) => {
    if (isMock()) {
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500));
      const scene = SAMPLE_SCENES[concept.term] ?? Object.values(SAMPLE_SCENES)[index % 4];
      send({ type: "done", data: { ...scene } satisfies Scene });
      return;
    }
    let chars = 0;
    const { data } = await streamJSON({
      system: SCENE_SYSTEM,
      content: [{ type: "text", text: sceneUserPrompt({ concept, deck, index, total }) }],
      schema: SceneSchema,
      effort: effortFor("scene"),
      maxTokens: 16000,
      onText: (delta) => {
        chars += delta.length;
        if (chars % 400 < delta.length) send({ type: "status", message: `장면 설계 중 (${chars}자)` });
      },
      signal,
    });
    send({ type: "done", data: normalizeScene(data as Partial<Scene>, concept.term) });
  }, req);
}
