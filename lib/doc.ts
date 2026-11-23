import { DEFAULT_SCALE } from "./rules";
import type { Platform, ScreenDoc } from "./types";

/* Loading screens into canvases. Browser only. */

export const MAX_RASTER_BYTES = 20 * 1024 * 1024;

export interface SanitisedSvg {
  str: string;
  W: number;
  H: number;
  minX: number;
  minY: number;
}

/** Strip scripts, event handlers and outside links, and make sure the SVG has a usable size. */
export function sanitiseSvg(text: string): SanitisedSvg {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("This SVG couldn't be read. Export it again from your design tool.");
  }
  svg.querySelectorAll("script,foreignObject,iframe,use[href^='http'],use[*|href^='http']").forEach((n) => n.remove());
  svg.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      if (/href$/i.test(a.name) && !/^(#|data:image\/)/i.test(a.value.trim())) el.removeAttribute(a.name);
    }
  });
  let minX = 0, minY = 0, W = 0, H = 0;
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every(isFinite) && p[2] > 0 && p[3] > 0) [minX, minY, W, H] = p;
  }
  if (!W) {
    W = parseFloat(svg.getAttribute("width") ?? "") || 390;
    H = parseFloat(svg.getAttribute("height") ?? "") || 844;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  }
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  return { str: new XMLSerializer().serializeToString(svg), W, H, minX, minY };
}

function svgToCanvas(str: string, W: number, H: number, k: number, hideText: boolean): Promise<HTMLCanvasElement> {
  if (hideText) str = str.replace(/(<svg[^>]*>)/, "$1<style>text,tspan{visibility:hidden !important}</style>");
  const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml" }));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(W * k));
      c.height = Math.max(1, Math.round(H * k));
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("This SVG couldn't be drawn. Check it doesn't link to outside files."));
    };
    img.src = url;
  });
}

const pixels = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);

/**
 * Load an SVG. It is mounted off-screen so layers can be measured with getBBox and
 * getComputedStyle, and rendered twice: once as-is, once with text hidden.
 */
export async function loadSvgDoc(text: string, name: string): Promise<ScreenDoc> {
  const s = sanitiseSvg(text);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:absolute;left:-20000px;top:0;width:${s.W}px;height:${s.H}px;overflow:hidden;visibility:hidden;pointer-events:none`;
  host.innerHTML = s.str;
  document.body.appendChild(host);
  const k = Math.min(2, Math.sqrt(14e6 / (s.W * s.H)));
  try {
    const [full, noText] = await Promise.all([svgToCanvas(s.str, s.W, s.H, k, false), svgToCanvas(s.str, s.W, s.H, k, true)]);
    return {
      kind: "svg", name, W: s.W, H: s.H, minX: s.minX, minY: s.minY, k,
      full, noText, fullData: pixels(full), noTextData: pixels(noText),
      url: URL.createObjectURL(new Blob([s.str], { type: "image/svg+xml" })),
      svgEl: host.querySelector("svg") as SVGSVGElement, mount: host,
    };
  } catch (e) {
    host.remove();
    throw e;
  }
}

export async function loadRasterDoc(file: File): Promise<ScreenDoc> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => { URL.revokeObjectURL(url); rej(new Error("This image couldn't be opened. Try a PNG or JPG.")); };
    i.src = url;
  });
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, W, H);
  x.drawImage(img, 0, 0);
  return { kind: "raster", name: file.name, W, H, minX: 0, minY: 0, k: 1, full: c, noText: null, fullData: pixels(c), noTextData: null, url, file };
}

export async function loadFile(file: File): Promise<ScreenDoc> {
  const n = (file.name || "").toLowerCase();
  if (file.type === "image/svg+xml" || n.endsWith(".svg")) return loadSvgDoc(await file.text(), file.name || "screen.svg");
  if (/^image\/(png|jpe?g)$/.test(file.type) || /\.(png|jpe?g)$/.test(n)) {
    if (file.size > MAX_RASTER_BYTES) throw new Error("That image is over 20 MB. Export it smaller and try again.");
    return loadRasterDoc(file);
  }
  throw new Error("Use a PNG, JPG or SVG export of one screen.");
}

export function disposeDoc(doc: ScreenDoc | null) {
  if (!doc) return;
  URL.revokeObjectURL(doc.url);
  doc.mount?.remove();
}

export const initialScale = (doc: ScreenDoc, platform: Platform) => (doc.kind === "svg" ? 1 : DEFAULT_SCALE[platform]);

/**
 * The screen as an image for Claude: longest side at most 1568 px (the size Claude reads at),
 * PNG to keep text crisp, JPEG only if the PNG is too heavy to send.
 */
export async function docImageForClaude(doc: ScreenDoc): Promise<{ data: string; mediaType: "image/png" | "image/jpeg" }> {
  const src = doc.full, s = Math.min(1, 1568 / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  let url = c.toDataURL("image/png"), mediaType: "image/png" | "image/jpeg" = "image/png";
  if (url.length > 3_500_000) { url = c.toDataURL("image/jpeg", 0.9); mediaType = "image/jpeg"; }
  return { data: url.slice(url.indexOf(",") + 1), mediaType };
}
