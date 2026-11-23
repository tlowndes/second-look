import { z } from "zod";

/*
 * Shapes Claude must answer in. Used as structured-output formats on the server,
 * so replies are always valid JSON of this shape. Values are still sanity-checked after.
 */

/** [x, y, width, height] on a 0–1000 scale of the image */
const Box = z.array(z.number());

export const LocateResult = z.object({
  texts: z.array(z.object({ text: z.string(), box: Box, bold: z.boolean(), disabled: z.boolean() })),
  targets: z.array(z.object({ label: z.string(), box: Box })),
  warnings: z.array(
    z.object({ type: z.enum(["colour", "placeholder", "disabled"]), element: z.string(), note: z.string(), box: Box }),
  ),
});
export type LocateResult = z.infer<typeof LocateResult>;

const Score = z.object({ score: z.number(), why: z.string() });

export const CritiqueResult = z.object({
  overall: z.string(),
  scores: z.object({ hierarchy: Score, contrast: Score, consistency: Score }),
  issues: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      category: z.enum(["Hierarchy", "Contrast", "Consistency"]),
      check: z.string(),
      element: z.string(),
      problem: z.string(),
      fix: z.string(),
      principle: z.string(),
      pin: z.object({ x: z.number(), y: z.number() }),
    }),
  ),
});
export type CritiqueResult = z.infer<typeof CritiqueResult>;

/* Request bodies the browser sends to the API routes */

const Platform = z.enum(["ios", "android", "web"]);
const Image = z.object({
  data: z.string().max(5_000_000),
  mediaType: z.enum(["image/png", "image/jpeg"]),
});

export const LocateRequest = z.object({
  image: Image,
  width: z.number().positive(),
  height: z.number().positive(),
  platform: Platform,
  context: z.string().max(300).default(""),
});
export type LocateRequest = z.infer<typeof LocateRequest>;

export const CritiqueRequest = z.object({
  image: Image,
  width: z.number().positive(),
  height: z.number().positive(),
  platform: Platform,
  context: z.string().max(300).default(""),
  tone: z.enum(["mentor", "blunt"]),
  tokens: z.string().max(4000).default(""),
  measured: z.array(z.string().max(300)).max(12).default([]),
});
export type CritiqueRequest = z.infer<typeof CritiqueRequest>;

export type ApiErrorCode =
  | "bad_request"
  | "no_key"
  | "invalid_key"
  | "daily_limit"
  | "visitor_limit"
  | "rate_limited"
  | "refused"
  | "invalid_json"
  | "overloaded"
  | "upstream";

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}
