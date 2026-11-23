import { contrastRatio, isRed, mix, roundRgb } from "./colour";
import { modeColour, ring, textContrastExact } from "./pixels";
import type { Box, RawFindings, RawStroke, RawTarget, RawText, RawWarning, RGB, ScreenDoc } from "./types";

/* Exact checks from SVG layers. Colours and sizes come from the file; backgrounds from a text-free render. */

const TARGET_RE = /(^|[_\-\s/.])(button|btn|tab|link|toggle|switch|checkbox|radio|chip|close|back|menu|cta|input|field|search|textbox|tap|target|plus|minus)(?=$|[_\-\s/.\d])/i;
const CONTAINER_RE = /(^|[_\-\s/.])(bar|bars|group|row|rows|list|section|container|stack|wrapper)(?=$|[_\-\s/.\d])/i;
export const INPUT_RE = /(input|field|search|textbox)/i;
const ICON_RE = /(^|[_\-\s/.])icons?(?=$|[_\-\s/.\d])/i;
const OFF_RE = /disabled|inactive/i;

export const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
export const trunc = (s: string, n = 42) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** "Back_button" → "Back button" */
export const prettyLayer = (id: string) => {
  const t = String(id || "").replace(/[_\-/]+/g, " ").replace(/\s+\d+$/, "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "Layer";
};

export function parseCssColour(c: string | null | undefined): { c: RGB; a: number } | null {
  const m = c && String(c).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v)));
  return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
}

const num = (v: string | null | undefined, d = 1) => {
  const n = parseFloat(v ?? "");
  return isNaN(n) ? d : n;
};

const centre = (b: Box): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const inside = (b: Box, p: [number, number]) => p[0] >= b[0] && p[0] <= b[0] + b[2] && p[1] >= b[1] && p[1] <= b[1] + b[3];
const overlapX = (a: Box, b: Box) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2];

export function analyseSvg(doc: ScreenDoc): RawFindings {
  const root = doc.svgEl;
  if (!root) throw new Error("The SVG isn't mounted.");

  const effOpacity = (el: Element) => {
    let o = 1;
    for (let n: Node | null = el; n && n !== root.parentNode; n = n.parentNode) {
      if (n.nodeType === 1) o *= num(getComputedStyle(n as Element).opacity);
    }
    return o;
  };
  const idChain = (el: Element) => {
    const ids: string[] = [];
    for (let n: Element | null = el; n && n !== root; n = n.parentElement) if (n.id) ids.push(n.id);
    return ids.join(" ");
  };
  /** Bounding box in root coordinates, plus the scale applied on the way. */
  const rootBox = (el: Element): { box: Box; scale: number } | null => {
    let bb: DOMRect;
    try { bb = (el as SVGGraphicsElement).getBBox(); } catch { return null; }
    if (!bb || (bb.width === 0 && bb.height === 0)) return null;
    const rootCtm = root.getScreenCTM(), elCtm = (el as SVGGraphicsElement).getScreenCTM();
    if (!rootCtm || !elCtm) return null;
    const m = rootCtm.inverse().multiply(elCtm);
    const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return {
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)],
      scale: Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)),
    };
  };

  const texts: RawText[] = [], strokes: RawStroke[] = [], targets: RawTarget[] = [], warnings: RawWarning[] = [];

  // Text layers
  for (const t of root.querySelectorAll("text")) {
    const label = clean(t.textContent);
    if (!label) continue;
    const rb = rootBox(t);
    if (!rb) continue;
    const styEl = [...t.querySelectorAll("tspan")].find((s) => clean(s.textContent)) ?? t;
    const cs = getComputedStyle(styEl), ids = idChain(t);
    const item: RawText = {
      label: "“" + trunc(label) + "”", box: rb.box, fontUnits: num(cs.fontSize, 16) * rb.scale,
      bold: num(cs.fontWeight, 400) >= 700, disabled: OFF_RE.test(ids), ids,
    };
    const fill = parseCssColour(cs.fill);
    if (!fill) item.unmeasured = "The text fill is a gradient or pattern.";
    else {
      const m = textContrastExact(doc, rb.box, fill.c, fill.a * num(cs.fillOpacity) * effOpacity(styEl));
      if (m) Object.assign(item, m);
      else item.unmeasured = "The text sits outside the frame.";
    }
    texts.push(item);
  }

  // Tappable layers, found by name. Outermost match wins.
  const picked: Element[] = [];
  for (const el of root.querySelectorAll("[id], a")) {
    const id = el.id || "", isA = el.tagName.toLowerCase() === "a";
    if (!(isA || (TARGET_RE.test(id) && !CONTAINER_RE.test(id)))) continue;
    if (picked.some((p) => p.contains(el))) continue;
    picked.push(el);
  }
  for (const el of picked) {
    const rb = rootBox(el);
    if (!rb) continue;
    if (rb.box[2] >= doc.W * 0.95 && rb.box[3] >= doc.H * 0.5) continue;
    targets.push({ label: prettyLayer(el.id || "Link"), box: rb.box, input: INPUT_RE.test(el.id), disabled: OFF_RE.test(el.id) });
  }

  // Non-text contrast: outlines of controls and icon fills
  for (const el of root.querySelectorAll("rect,circle,ellipse,path,polygon,polyline")) {
    const ids = idChain(el);
    if (!(TARGET_RE.test(ids) || ICON_RE.test(ids)) || OFF_RE.test(ids)) continue;
    const cs = getComputedStyle(el);
    let colour: RGB | null = null, alpha = 1, kind = "";
    const st = parseCssColour(cs.stroke);
    if (st && cs.stroke !== "none" && num(cs.strokeWidth, 0) > 0) {
      colour = st.c; alpha = st.a * num(cs.strokeOpacity) * effOpacity(el); kind = "outline";
    } else if (ICON_RE.test(ids)) {
      const f = parseCssColour(cs.fill);
      if (f) { colour = f.c; alpha = f.a * num(cs.fillOpacity) * effOpacity(el); kind = "icon"; }
    }
    if (!colour || alpha <= 0) continue;
    const rb = rootBox(el);
    if (!rb || rb.box[2] <= 8 || rb.box[3] <= 8) continue;
    const sw = kind === "outline" ? num(cs.strokeWidth, 1) / 2 : 0;
    const r = doc.noTextData ? ring(doc, doc.noTextData, rb.box, sw + 1.5, sw + 4) : [];
    if (!r.length) continue;
    const bg = modeColour(r), fg = roundRgb(mix(colour, bg, alpha));
    strokes.push({ label: prettyLayer(ids.split(" ")[0] || "Shape") + " " + kind, box: rb.box, fg, bg, ratio: contrastRatio(fg, bg) });
  }

  // Placeholder as the only label
  for (const tg of targets.filter((t) => t.input)) {
    const inner = texts.filter((t) => inside(tg.box, centre(t.box)));
    if (!inner.length) continue;
    const labelled = texts.some(
      (t) => !inner.includes(t) && t.box[1] + t.box[3] <= tg.box[1] + 2 && tg.box[1] - (t.box[1] + t.box[3]) <= 16 && overlapX(t.box, tg.box),
    );
    if (!labelled) {
      warnings.push({ type: "placeholder", element: tg.label, note: inner[0].label + " sits inside the field with no visible label. It disappears once someone starts typing.", box: tg.box });
    }
  }

  // Disabled controls
  const offEls: Element[] = [];
  for (const el of root.querySelectorAll("[id]")) if (OFF_RE.test(el.id) && !offEls.some((p) => p.contains(el))) offEls.push(el);
  for (const el of offEls) {
    const rb = rootBox(el);
    if (rb) warnings.push({ type: "disabled", element: prettyLayer(el.id), note: "Disabled controls are exempt from contrast rules, so check something other than faded colour explains the state, such as helper text.", box: rb.box });
  }

  // Colour as the only signal: red or error-named text with no icon beside it
  const icons = [...root.querySelectorAll("[id]")].filter((el) => ICON_RE.test(el.id)).map(rootBox).filter((r): r is NonNullable<typeof r> => !!r).map((r) => r.box);
  for (const t of texts) {
    if (t.disabled || !t.fg) continue;
    if (!(/error|invalid|warning|alert/i.test(t.ids) || isRed(t.fg))) continue;
    const near = icons.some((b) => Math.abs(centre(b)[1] - centre(t.box)[1]) < 24 && b[0] < t.box[0] + 4 && t.box[0] - (b[0] + b[2]) < 32);
    if (!near) warnings.push({ type: "colour", element: t.label, note: "This message relies on red text alone. Add an icon or a word such as “Error” so it reads without colour.", box: t.box });
  }

  return { estimated: false, texts, strokes, targets, warnings };
}
