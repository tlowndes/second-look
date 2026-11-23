import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const req = (headers: Record<string, string> = {}, body: unknown = valid) =>
  new Request("http://localhost/api/critique", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const valid = { image: { data: "aGk=", mediaType: "image/png" }, width: 390, height: 844, platform: "ios", tone: "mentor" };

describe("API key handling", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("asks for a key when no hosted key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { POST } = await import("@/app/api/critique/route");
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("no_key");
  });

  it("rejects a malformed visitor key before calling Anthropic", async () => {
    const { POST } = await import("@/app/api/critique/route");
    const res = await POST(req({ "x-user-anthropic-key": "not-a-key" }));
    expect((await res.json()).error.code).toBe("invalid_key");
  });

  it("rejects a bad body", async () => {
    const { POST } = await import("@/app/api/critique/route");
    const res = await POST(req({}, { image: "nope" }));
    expect((await res.json()).error.code).toBe("bad_request");
  });

  it("caps hosted runs per visitor, then for the whole day", async () => {
    vi.stubEnv("PER_VISITOR_DAILY_LIMIT", "2");
    vi.stubEnv("DAILY_LIMIT", "3");
    const { takeHostedRun } = await import("@/lib/server/limit");
    expect(await takeHostedRun("a")).toEqual({ ok: true });
    expect(await takeHostedRun("a")).toEqual({ ok: true });
    expect(await takeHostedRun("a")).toEqual({ ok: false, reason: "visitor_limit" });
    expect(await takeHostedRun("b")).toEqual({ ok: true });
    expect(await takeHostedRun("c")).toEqual({ ok: false, reason: "daily_limit" });
  });
});
