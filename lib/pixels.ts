import { clamp, colourDistance, contrastRatio, mix, roundRgb } from "./colour";
import type { Box, RGB, ScreenDoc } from "./types";

/* Pixel sampling. Every box is in document units; the doc's k maps them to canvas pixels. */

export interface Sample {
  x: number;
  y: number;
  c: RGB;
}

export function region(doc: ScreenDoc, data: ImageData, box: Box, maxSamples = 8000): Sample[] {
  const { k, minX, minY } = doc;
  const cw = data.width, ch = data.height;
  const x0 = clamp(Math.floor((box[0] - minX) * k), 0, cw);
  const y0 = clamp(Math.floor((box[1] - minY) * k), 0, ch);
  const x1 = clamp(Math.ceil((box[0] + box[2] - minX) * k), 0, cw);
  const y1 = clamp(Math.ceil((box[1] + box[3] - minY) * k), 0, ch);
  const w = x1 - x0, h = y1 - y0, out: Sample[] = [];
  if (w <= 0 || h <= 0) return out;
  const step = Math.max(1, Math.sqrt((w * h) / maxSamples));
  const a = data.data;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const xi = Math.floor(x), yi = Math.floor(y), i = (yi * cw + xi) * 4;
      out.push({ x: xi / k + minX, y: yi / k + minY, c: [a[i], a[i + 1], a[i + 2]] });
    }
  }
  return out;
}

/** Bucket colours (5 bits per channel) and return buckets by frequency. */
export function bins(cols: RGB[]): { n: number; c: RGB }[] {
  const m = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (const p of cols) {
    const key = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
    let b = m.get(key);
    if (!b) m.set(key, (b = { n: 0, r: 0, g: 0, b: 0 }));
    b.n++; b.r += p[0]; b.g += p[1]; b.b += p[2];
  }
  return [...m.values()]
    .map((b) => ({ n: b.n, c: roundRgb([b.r / b.n, b.g / b.n, b.b / b.n]) }))
    .sort((a, b) => b.n - a.n);
}

export const modeColour = (cols: RGB[]): RGB => bins(cols)[0]?.c ?? [255, 255, 255];

/** Pixels in a ring between d1 and d2 units outside the box. */
export function ring(doc: ScreenDoc, data: ImageData, box: Box, d1: number, d2: number): RGB[] {
  const [x, y, w, h] = box, out: RGB[] = [];
  const sides: Box[] = [
    [x - d2, y - d2, w + 2 * d2, d2 - d1],
    [x - d2, y + h + d1, w + 2 * d2, d2 - d1],
    [x - d2, y - d1, d2 - d1, h + 2 * d1],
    [x + w + d1, y - d1, d2 - d1, h + 2 * d1],
  ];
  for (const b of sides) for (const p of region(doc, data, b, 800)) out.push(p.c);
  return out;
}

export interface ContrastSample {
  ratio: number;
  fg: RGB;
  bg: RGB;
  varies: boolean;
}

/** Exact text contrast: the background comes from a render with all text hidden. */
export function textContrastExact(doc: ScreenDoc, box: Box, fg: RGB, alpha: number): ContrastSample | null {
  if (!doc.noTextData) return null;
  const inner: Box = [box[0] + 1, box[1] + box[3] * 0.18, Math.max(1, box[2] - 2), Math.max(1, box[3] * 0.64)];
  const px = region(doc, doc.noTextData, inner, 6000).map((p) => p.c);
  if (!px.length) return null;
  const bg = modeColour(px);
  let varied = 0;
  const rs: { r: number; p: RGB }[] = [];
  for (const p of px) {
    if (colourDistance(p, bg) > 12) varied++;
    rs.push({ r: contrastRatio(mix(fg, p, alpha), p), p });
  }
  if (varied / px.length <= 0.04) {
    const comp = roundRgb(mix(fg, bg, alpha));
    return { ratio: contrastRatio(comp, bg), fg: comp, bg, varies: false };
  }
  // Gradient or image behind the text: report the worst 2% so one pixel can't fail it.
  rs.sort((a, b) => a.r - b.r);
  const w = rs[Math.floor(rs.length * 0.02)];
  return { ratio: w.r, fg: roundRgb(mix(fg, w.p, alpha)), bg: w.p, varies: true };
}

export interface PixelContrast {
  ratio: number;
  fg: RGB;
  bg: RGB;
  /** Tight bounds of the "ink" (the foreground pixels) */
  ink: Box | null;
}

/**
 * Estimated contrast from flattened pixels: the dominant colour is the background,
 * the most contrasting common colour is the foreground.
 */
export function analysePixels(doc: ScreenDoc, box: Box, data: ImageData = doc.fullData): PixelContrast | null {
  const px = region(doc, data, box, 20000);
  if (px.length < 12) return null;
  const bs = bins(px.map((p) => p.c));
  const bg = bs[0].c, minN = Math.max(3, px.length * 0.015);
  let fg: RGB | null = null, best = 1;
  for (const b of bs.slice(1)) {
    if (b.n < minN) continue;
    const r = contrastRatio(b.c, bg);
    if (r > best) { best = r; fg = b.c; }
  }
  if (!fg) return { ratio: 1, fg: bg, bg, ink: null };
  const thr = 1 + (best - 1) * 0.5;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of px) {
    if (contrastRatio(p.c, bg) >= thr) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  }
  const ink: Box | null = isFinite(x0) ? [x0, y0, x1 - x0 + 1 / doc.k, y1 - y0 + 1 / doc.k] : null;
  return { ratio: best, fg, bg, ink };
}

/** Snap a rough control box (from the model) to the visible shape underneath it. */
export function refineTarget(doc: ScreenDoc, box: Box): Box {
  const pad = Math.max(4, Math.min(box[2], box[3]) * 0.25);
  const big: Box = [box[0] - pad, box[1] - pad, box[2] + 2 * pad, box[3] + 2 * pad];
  const px = region(doc, doc.fullData, big, 24000);
  const edge = px.filter(
    (p) => p.x < big[0] + pad / 2 || p.x > big[0] + big[2] - pad / 2 || p.y < big[1] + pad / 2 || p.y > big[1] + big[3] - pad / 2,
  );
  if (!edge.length) return box;
  const bg = modeColour(edge.map((p) => p.c));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of px) {
    if (colourDistance(p.c, bg) > 36) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  }
  if (!isFinite(x0)) return box;
  const r: Box = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  if (r[2] > box[2] * 1.8 || r[3] > box[3] * 1.8 || r[2] < box[2] * 0.4 || r[3] < box[3] * 0.4) return box;
  return r;
}
