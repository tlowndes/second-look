import { critiquePrompt } from "@/lib/ai/prompts";
import { CritiqueRequest, CritiqueResult } from "@/lib/ai/schemas";
import { apiError, askWithImage, resolveKey } from "@/lib/server/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A senior-designer critique of one screen: overall read, three scores and ranked issues. */
export async function POST(req: Request) {
  const body = CritiqueRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("bad_request", "The request was missing something. Reload and try again.", 400);
  const key = await resolveKey(req);
  if ("error" in key) return key.error;
  const out = await askWithImage({ key: key.key, prompt: critiquePrompt(body.data), image: body.data.image, schema: CritiqueResult });
  return out.ok ? Response.json(out.data) : out.res;
}
