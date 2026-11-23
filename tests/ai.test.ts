import { describe, expect, it } from "vitest";
import { normaliseCritique } from "@/lib/ai/normalise";
import { critiquePrompt, locatePrompt } from "@/lib/ai/prompts";
import { CritiqueRequest, type CritiqueResult } from "@/lib/ai/schemas";

const issue = (over: Partial<CritiqueResult["issues"][number]> = {}): CritiqueResult["issues"][number] => ({
  severity: "medium", category: "Hierarchy", check: "Grouping", element: "Promo field", problem: "Floats.", fix: "Add a label.",
  principle: "Law of proximity", pin: { x: 0.4, y: 0.3 }, ...over,
});
const result = (issues: CritiqueResult["issues"]): CritiqueResult => ({
  overall: "  Calm screen.   One big problem. ",
  scores: { hierarchy: { score: 4.4, why: "ok" }, contrast: { score: 9, why: "x" }, consistency: { score: 3, why: "y" } },
  issues,
});

describe("normaliseCritique", () => {
  it("sorts by severity, tidies text and clamps scores and pins", () => {
    const k = normaliseCritique(result([issue({ severity: "low" }), issue({ severity: "high", pin: { x: 3, y: -1 } })]), "blunt")!;
    expect(k.issues.map((i) => i.severity)).toEqual(["high", "low"]);
    expect(k.issues[0].pin).toEqual({ x: 1, y: 0 });
    expect(k.overall).toBe("Calm screen. One big problem.");
    expect(k.scores.hierarchy?.score).toBe(4);
    expect(k.scores.contrast?.score).toBe(5);
    expect(k).toMatchObject({ tone: "blunt", example: false });
  });

  it("drops empty issues and rejects a critique with none left", () => {
    expect(normaliseCritique(result([issue({ problem: "  " })]), "mentor")).toBeNull();
  });
});

describe("prompts", () => {
  const req = CritiqueRequest.parse({
    image: { data: "x", mediaType: "image/png" }, width: 390, height: 844, platform: "android", tone: "blunt",
    measured: ["Body text contrast: “Step 2 of 3” measured 2.41:1, needs 4.5:1"],
  });

  it("includes tone, platform units and measured fails", () => {
    const p = critiquePrompt(req);
    expect(p).toContain("Blunt senior designer");
    expect(p).toContain("sizes in dp");
    expect(p).toContain("measured 2.41:1");
    expect(p).not.toContain("design tokens");
  });

  it("describes the 0–1000 box scale for locating elements", () => {
    expect(locatePrompt({ ...req, context: "checkout" })).toMatch(/checkout[\s\S]*0 to 1000 scale/);
  });

  it("rejects oversized or unexpected requests", () => {
    expect(CritiqueRequest.safeParse({ ...req, tokens: "x".repeat(5000) }).success).toBe(false);
    expect(CritiqueRequest.safeParse({ ...req, image: { data: "x", mediaType: "image/gif" } }).success).toBe(false);
  });
});
