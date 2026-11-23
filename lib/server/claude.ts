import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiError, ApiErrorCode } from "../ai/schemas";
import { takeHostedRun, visitorId } from "./limit";

export const MODEL = "claude-opus-5-5";

/** Header a visitor's own key arrives in. It is used for one request and never stored or logged. */
export const USER_KEY_HEADER = "x-user-anthropic-key";

export const hostedKeyAvailable = () => !!process.env.ANTHROPIC_API_KEY;

export function apiError(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}

/** Pick the key for this request: the visitor's own, or the hosted one within the daily caps. */
export async function resolveKey(req: Request): Promise<{ key: string } | { error: NextResponse }> {
  const own = req.headers.get(USER_KEY_HEADER)?.trim();
  if (own) {
    if (!/^sk-ant-[\w-]{20,}$/.test(own)) return { error: apiError("invalid_key", "That doesn't look like an Anthropic API key.", 400) };
    return { key: own };
  }
  const hosted = process.env.ANTHROPIC_API_KEY;
  if (!hosted) return { error: apiError("no_key", "Add your own Anthropic API key to run this.", 401) };
  const run = await takeHostedRun(await visitorId(req));
  if (!run.ok) {
    return {
      error: apiError(
        run.reason,
        run.reason === "visitor_limit"
          ? "You've used today's free runs. Add your own Anthropic API key to keep going."
          : "Today's free runs have all been used. Add your own Anthropic API key, or come back tomorrow.",
        429,
      ),
    };
  }
  return { key: hosted };
}

/** Send one image and a prompt, and get back JSON in the given shape. */
export async function askWithImage<T extends z.ZodType>(opts: {
  key: string;
  prompt: string;
  image: { data: string; mediaType: "image/png" | "image/jpeg" };
  schema: T;
  maxTokens?: number;
}): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  const client = new Anthropic({ apiKey: opts.key, maxRetries: 1, timeout: 110_000 });
  try {
    const msg = await client.beta.messages.parse({
      betas: ["server-side-fallback-2026-07-01"],
      // If Opus declines on a safety check, the API retries on a fallback model in the same call.
      fallbacks: "default",
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      output_config: { effort: "medium", format: zodOutputFormat(opts.schema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } },
            { type: "text", text: opts.prompt },
          ],
        },
      ],
    });
    if (msg.stop_reason === "refusal") return { ok: false, res: apiError("refused", "Claude declined to review this image.", 422) };
    if (!msg.parsed_output) return { ok: false, res: apiError("invalid_json", "Claude's answer couldn't be read. Try again.", 502) };
    return { ok: true, data: msg.parsed_output as z.infer<T> };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, res: apiError("invalid_key", "That API key was turned down by Anthropic. Check it and try again.", 401) };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, res: apiError("rate_limited", "Too many requests just now. Wait a minute and try again.", 429) };
    }
    if (e instanceof Anthropic.BadRequestError) {
      return { ok: false, res: apiError("bad_request", "This image couldn't be sent to Claude. Try a PNG or JPG under 20 MB.", 400) };
    }
    if (e instanceof Anthropic.InternalServerError || (e instanceof Anthropic.APIError && e.status === 529)) {
      return { ok: false, res: apiError("overloaded", "Claude is busy right now. Try again in a moment.", 503) };
    }
    console.error("Claude request failed:", e instanceof Error ? e.name : "unknown");
    return { ok: false, res: apiError("upstream", "Claude couldn't be reached. Try again.", 502) };
  }
}
