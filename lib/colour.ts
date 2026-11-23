import type { RGB } from "./types";

/* WCAG 2.x relative luminance and contrast, plus an OKLab search for the nearest passing colour. */

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const rgb2hex = (c: readonly number[]) =>
  "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();

export const hex2rgb = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const lin = (v: number) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = (c: readonly number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);

export const contrastRatio = (a: readonly number[], b: readonly number[]) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Ratios are floored, never rounded up, so 4.499 never shows as a pass. */
export const formatRatio = (r: number) => (Math.floor(r * 100) / 100).toFixed(2) + ":1";

/** Composite a foreground over a background at the given alpha. */
export const mix = (fg: readonly number[], bg: readonly number[], a: number): RGB =>
  [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as RGB;

export const roundRgb = (c: readonly number[]): RGB => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];

export const colourDistance = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

export function toOklab([r, g, b]: readonly number[]): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab([L, a, b]: readonly number[]): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (v: number) => {
    v = clamp(v, 0, 1);
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  };
  return [Math.round(enc(R)), Math.round(enc(G)), Math.round(enc(B))];
}

/**
 * The closest colour to `fg` (by OKLab lightness, hue kept) that reaches `target` against `bg`.
 * Searches lighter and darker and keeps whichever needs the smaller change.
 */
export function nearestPassing(fg: readonly number[], bg: readonly number[], target: number): RGB {
  const [L, a, b] = toOklab(fg);
  let best: { d: number; c: RGB } | null = null;
  for (const dir of [-1, 1]) {
    for (let d = 0.004; d <= 1.0001; d += 0.004) {
      const nL = L + dir * d;
      if (nL < 0 || nL > 1) break;
      const c = fromOklab([nL, a, b]);
      if (contrastRatio(c, bg) >= target + 0.04) {
        if (!best || d < best.d) best = { d, c };
        break;
      }
    }
  }
  if (best) return best.c;
  const black: RGB = [20, 20, 20];
  const white: RGB = [255, 255, 255];
  return contrastRatio(black, bg) > contrastRatio(white, bg) ? black : white;
}

export const isRed = (c: readonly number[]) => c[0] > 150 && c[0] > c[1] * 1.6 && c[0] > c[2] * 1.5;
