import { MODEL, hasKey, isMock } from "@/lib/claude";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, hasKey: hasKey(), mock: isMock(), model: MODEL });
}
