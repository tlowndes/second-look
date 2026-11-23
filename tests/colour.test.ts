import { describe, expect, it } from "vitest";
import { contrastRatio, formatRatio, fromOklab, hex2rgb, nearestPassing, rgb2hex, toOklab } from "@/lib/colour";

describe("contrastRatio", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([47, 111, 237], [47, 111, 237])).toBe(1);
  });

  it("matches known WCAG values", () => {
    // #767676 on white is the classic "just passes AA" grey
    expect(contrastRatio(hex2rgb("#767676"), [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(contrastRatio(hex2rgb("#777777"), [255, 255, 255])).toBeLessThan(4.5);
  });

  it("is symmetric", () => {
    const a = hex2rgb("#2F6FED"), b = hex2rgb("#F6F7F9");
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });
});

describe("formatRatio", () => {
  it("floors so a near miss never reads as a pass", () => {
    expect(formatRatio(4.499)).toBe("4.49:1");
    expect(formatRatio(3)).toBe("3.00:1");
  });
});

describe("hex helpers", () => {
  it("round-trips", () => {
    expect(rgb2hex(hex2rgb("#A3A8B0"))).toBe("#A3A8B0");
    expect(rgb2hex([300, -4, 15.6])).toBe("#FF0010");
  });
});

describe("OKLab", () => {
  it("round-trips sRGB within one step", () => {
    for (const hex of ["#2F6FED", "#E5484D", "#111418", "#F4B860"]) {
      const c = hex2rgb(hex), back = fromOklab(toOklab(c));
      back.forEach((v, i) => expect(Math.abs(v - c[i])).toBeLessThanOrEqual(1));
    }
  });
});

describe("nearestPassing", () => {
  it("returns a colour that reaches the target", () => {
    const bg: [number, number, number] = [255, 255, 255];
    for (const target of [3, 4.5, 7]) {
      const fix = nearestPassing(hex2rgb("#A3A8B0"), bg, target);
      expect(contrastRatio(fix, bg)).toBeGreaterThanOrEqual(target);
    }
  });

  it("goes lighter on a dark background", () => {
    const bg = hex2rgb("#111418"), fg = hex2rgb("#3A3F48");
    const fix = nearestPassing(fg, bg, 4.5);
    expect(toOklab(fix)[0]).toBeGreaterThan(toOklab(fg)[0]);
  });

  it("keeps the change small", () => {
    // #A3A8B0 only needs to darken a little; it should stay grey, not jump to black
    const fix = nearestPassing(hex2rgb("#A3A8B0"), [255, 255, 255], 4.5);
    expect(contrastRatio(fix, [255, 255, 255])).toBeLessThan(5);
  });
});
