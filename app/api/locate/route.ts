import { locatePrompt } from "@/lib/ai/prompts";
import { LocateRequest, LocateResult } from "@/lib/ai/schemas";
import { apiError, askWithImage, resolveKey } from "@/lib/server/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Find text and controls in a screenshot. The browser measures their pixels afterwards. */
export async function POST(req: Request) {
  const body = LocateRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("bad_request", "The request was missing something. Reload and try again.", 400);
  const key = await resolveKey(req);
  if ("error" in key) return key.error;
  const out = await askWithImage({ key: key.key, prompt: locatePrompt(body.data), image: body.data.image, schema: LocateResult });
  return out.ok ? Response.json(out.data) : out.res;
}
