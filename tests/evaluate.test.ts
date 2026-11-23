import { describe, expect, it } from "vitest";
import { countFindings, evaluate, summarise } from "@/lib/evaluate";
import type { RawFindings, RawText, Settings } from "@/lib/types";

const text = (over: Partial<RawText>): RawText => ({
  label: "“Label”", box: [0, 0, 100, 20], fontUnits: 16, bold: false, disabled: false, ids: "",
  ratio: 7, fg: [0, 0, 0], bg: [255, 255, 255], varies: false, ...over,
});
const raw = (over: Partial<RawFindings>): RawFindings => ({ estimated: false, texts: [], strokes: [], targets: [], warnings: [], ...over });
const ios: Settings = { platform: "ios", scale: 1, level: "AA" };
const web: Settings = { platform: "web", scale: 1, level: "AA" };

describe("text contrast", () => {
  it("needs 4.5:1 for body text and 3:1 for large text at AA", () => {
    const items = evaluate(raw({ texts: [text({ ratio: 4 }), text({ ratio: 4, fontUnits: 24 })] }), ios);
    expect(items.map((i) => [i.check, i.group])).toEqual([
      ["Body text contrast", "fail"],
      ["Large text contrast", "pass"],
    ]);
  });

  it("treats 14pt bold (18.66px) as large text", () => {
    const [it] = evaluate(raw({ texts: [text({ ratio: 3.5, fontUnits: 19, bold: true })] }), ios);
    expect(it.group).toBe("pass");
  });

  it("raises the bar at AAA", () => {
    const [it] = evaluate(raw({ texts: [text({ ratio: 5 })] }), { ...ios, level: "AAA" });
    expect(it).toMatchObject({ group: "fail", required: "7:1", rule: "WCAG 1.4.6" });
  });

  it("divides font size by scale", () => {
    // 72 px at 3x is 24 pt, so large text
    const [it] = evaluate(raw({ texts: [text({ ratio: 3.2, fontUnits: 72 })] }), { ...ios, scale: 3 });
    expect(it.check).toBe("Large text contrast");
  });

  it("suggests a fix colour that passes", () => {
    const [it] = evaluate(raw({ texts: [text({ ratio: 2.4, fg: [163, 168, 176] })] }), ios);
    expect(it.fixHex).toMatch(/^#[0-9A-F]{6}$/);
    expect(parseFloat(it.fixRatio!)).toBeGreaterThanOrEqual(4.5);
  });

  it("sends estimated results near the threshold to check by hand", () => {
    const [it] = evaluate(raw({ estimated: true, texts: [text({ ratio: 4.35 })] }), ios);
    expect(it.group).toBe("manual");
  });

  it("skips disabled text and flags small text", () => {
    const items = evaluate(raw({ texts: [text({ disabled: true }), text({ fontUnits: 10 })] }), ios);
    expect(items.map((i) => i.check)).toEqual(["Text under 12 pt", "Body text contrast"]);
  });

  it("marks unmeasured text for checking by hand", () => {
    const [it] = evaluate(raw({ texts: [text({ ratio: undefined, unmeasured: "Gradient fill." })] }), ios);
    expect(it).toMatchObject({ group: "manual", note: "Gradient fill." });
  });
});

describe("touch targets", () => {
  it("uses 44pt on iOS and 48dp on Android", () => {
    const targets = [{ label: "Button", box: [0, 0, 46, 46] as [number, number, number, number], input: false }];
    expect(evaluate(raw({ targets }), ios)[0].group).toBe("pass");
    expect(evaluate(raw({ targets }), { ...ios, platform: "android" })[0].group).toBe("fail");
  });

  it("explains how much to grow a small target", () => {
    const [it] = evaluate(raw({ targets: [{ label: "Close", box: [0, 0, 30, 44], input: false }] }), ios);
    expect(it.fixTarget).toContain("7 pt left and right");
  });

  it("applies the WCAG 2.5.8 spacing exception on the web", () => {
    const small = (x: number) => ({ label: "Dot", box: [x, 0, 16, 16] as [number, number, number, number], input: false });
    // Far apart: passes on spacing. Close together: fails.
    expect(evaluate(raw({ targets: [small(0), small(100)] }), web).every((i) => i.group === "pass")).toBe(true);
    expect(evaluate(raw({ targets: [small(0), small(20)] }), web).every((i) => i.group === "fail")).toBe(true);
  });
});

describe("ordering and summary", () => {
  it("lists fails first, numbers non-passes and summarises them", () => {
    const items = evaluate(
      raw({
        texts: [text({ ratio: 12 }), text({ ratio: 2 })],
        targets: [{ label: "Back", box: [0, 0, 28, 28], input: false }],
        warnings: [{ type: "colour", element: "“Card expired”", note: "Red only.", box: null }],
      }),
      ios,
    );
    expect(items.map((i) => [i.group, i.n])).toEqual([["fail", 1], ["fail", 2], ["warn", 3], ["pass", undefined]]);
    expect(countFindings(items)).toMatchObject({ fail: 2, contrast: 1, target: 1, warn: 1, pass: 1 });
    expect(summarise(items)).toMatchObject({ verdict: "FAIL", what: "1 contrast fail, 1 touch target fail" });
  });

  it("passes a clean screen", () => {
    expect(summarise(evaluate(raw({ texts: [text({})] }), ios)).verdict).toBe("PASS");
  });
});
