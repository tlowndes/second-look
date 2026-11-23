import "server-only";

/*
 * Daily caps for runs on the hosted key. With Upstash Redis configured the counts are shared
 * across serverless instances; without it they live in memory, which is fine locally.
 */

const today = () => new Date().toISOString().slice(0, 10);

const memory = new Map<string, number>();

async function incr(key: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const res = await fetch(url.replace(/\/$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, "93600"]]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Rate limit store unavailable");
    const out = (await res.json()) as { result: number }[];
    return out[0].result;
  }
  const day = today();
  for (const k of memory.keys()) if (!k.includes(day)) memory.delete(k);
  const n = (memory.get(key) ?? 0) + 1;
  memory.set(key, n);
  return n;
}

const limit = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export type LimitResult = { ok: true } | { ok: false; reason: "daily_limit" | "visitor_limit" };

/** Count one hosted run for this visitor. Visitor cap is checked first so one person can't drain the day. */
export async function takeHostedRun(visitor: string): Promise<LimitResult> {
  const day = today();
  const mine = await incr(`sl:${day}:v:${visitor}`);
  if (mine > limit("PER_VISITOR_DAILY_LIMIT", 6)) return { ok: false, reason: "visitor_limit" };
  const all = await incr(`sl:${day}:all`);
  if (all > limit("DAILY_LIMIT", 60)) return { ok: false, reason: "daily_limit" };
  return { ok: true };
}

/** A stable, non-reversible visitor id from the request's IP. */
export async function visitorId(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("second-look:" + ip));
  return [...new Uint8Array(bytes).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
