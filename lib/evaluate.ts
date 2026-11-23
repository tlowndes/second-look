import { clamp, contrastRatio, formatRatio, nearestPassing, rgb2hex } from "./colour";
import { RULES, UNITS } from "./rules";
import type { Box, Finding, RawFindings, Settings } from "./types";

/* Judge raw findings against WCAG 2.2 AA or AAA and the platform's target size. Pure, so it's unit tested. */

const fmtN = (v: number) => (Math.round(v * 10) / 10).toString();
const centre = (b: Box): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];

/** Estimated results this close to a threshold go to "check by hand". */
export const ESTIMATE_MARGIN = 0.3;

export function evaluate(raw: RawFindings | null, { platform, scale: sc, level }: Settings): Finding[] {
  if (!raw) return [];
  const items: Finding[] = [];
  const u = UNITS[platform], AA = level === "AA", est = raw.estimated;
  let id = 0;

  for (const t of raw.texts) {
    if (t.disabled) continue;
    const size = t.fontUnits / sc;
    const large = size >= 24 || (t.bold && size >= 18.66);
    const req = AA ? (large ? 3 : 4.5) : large ? 4.5 : 7;
    const rule = AA ? "1.4.3" : "1.4.6";
    const check = t.varies ? "Text on images or gradients" : large ? "Large text contrast" : "Body text contrast";
    const base: Finding = { id: "c" + id++, kind: "contrast", group: "pass", check, element: t.label, box: t.box, rule: "WCAG " + rule, ruleUrl: RULES[rule], estimated: est };
    if (t.unmeasured || t.ratio == null || !t.fg || !t.bg) {
      items.push({ ...base, group: "manual", note: t.unmeasured || "Couldn't measure this text." });
      continue;
    }
    let group: Finding["group"] = t.ratio >= req ? "pass" : "fail";
    if (est && Math.abs(t.ratio - req) < ESTIMATE_MARGIN) group = "manual";
    const it: Finding = {
      ...base, group, fg: t.fg, bg: t.bg, ratio: t.ratio, measured: formatRatio(t.ratio), required: req + ":1",
      sizeNote: `${fmtN(size)} ${u}${t.bold ? " bold" : ""}`,
    };
    if (group !== "pass") {
      const c = nearestPassing(t.fg, t.bg, req);
      it.fixHex = rgb2hex(c);
      it.fixRatio = formatRatio(contrastRatio(c, t.bg));
      it.fixText = t.varies ? "or add a solid panel or scrim behind the text" : "";
    }
    if (t.varies) it.note = "The background changes under this text, so the ratio is taken at its lightest or darkest point.";
    items.push(it);
    if (size < 12) {
      items.push({
        id: "w" + id++, kind: "warn", group: "warn", check: "Text under 12 " + u, element: t.label, box: t.box,
        measured: `${fmtN(size)} ${u}`, note: "Small text is hard to read for many people. Use 12 " + u + " or more.",
        rule: "WCAG 1.4.4", ruleUrl: RULES["1.4.4"],
      });
    }
  }

  for (const s of raw.strokes) {
    const group = s.ratio >= 3 ? "pass" : "fail";
    const it: Finding = {
      id: "n" + id++, kind: "nontext", group, check: "Icons, borders and outlines", element: s.label, box: s.box,
      fg: s.fg, bg: s.bg, ratio: s.ratio, measured: formatRatio(s.ratio), required: "3:1", rule: "WCAG 1.4.11", ruleUrl: RULES["1.4.11"], estimated: est,
    };
    if (group === "fail") {
      const c = nearestPassing(s.fg, s.bg, 3);
      it.fixHex = rgb2hex(c);
      it.fixRatio = formatRatio(contrastRatio(c, s.bg));
    }
    items.push(it);
  }

  const reqT = platform === "ios" ? 44 : platform === "android" ? 48 : AA ? 24 : 44;
  const ruleT = platform === "ios" ? "Apple HIG" : platform === "android" ? "Material" : AA ? "2.5.8" : "2.5.5";
  const ts = raw.targets.map((t) => ({ ...t, w: t.box[2] / sc, h: t.box[3] / sc }));
  ts.forEach((t, i) => {
    let group: Finding["group"] = t.w >= reqT && t.h >= reqT ? "pass" : "fail";
    let note = "";
    // WCAG 2.5.8 spacing exception: a 24 px circle on each undersized target must not overlap another target.
    if (group === "fail" && platform === "web" && AA) {
      const r = 12 * sc, [cx, cy] = centre(t.box);
      const clash = ts.some((o, j) => {
        if (j === i) return false;
        const nx = clamp(cx, o.box[0], o.box[0] + o.box[2]), ny = clamp(cy, o.box[1], o.box[1] + o.box[3]);
        if (Math.hypot(cx - nx, cy - ny) < r) return true;
        if (o.w < 24 || o.h < 24) {
          const [ox, oy] = centre(o.box);
          if (Math.hypot(cx - ox, cy - oy) < 2 * r) return true;
        }
        return false;
      });
      if (!clash) { group = "pass"; note = "Under 24 px, but spaced enough from other targets to meet the spacing exception."; }
      else note = "Under 24 px and too close to another target.";
    }
    if (est && group !== "pass" && Math.min(t.w, t.h) >= reqT - 2) group = "manual";
    const it: Finding = {
      id: "t" + id++, kind: "target", group,
      check: platform === "web" && note ? "Target spacing" : "Touch target size",
      element: t.label, box: t.box, measured: `${fmtN(t.w)} × ${fmtN(t.h)} ${u}`, required: `${reqT} × ${reqT} ${u}`,
      rule: ruleT === "Apple HIG" || ruleT === "Material" ? ruleT : "WCAG " + ruleT, ruleUrl: RULES[ruleT], estimated: est, note,
    };
    if (group !== "pass") {
      const px = Math.max(0, Math.ceil((reqT - t.w) / 2)), py = Math.max(0, Math.ceil((reqT - t.h) / 2));
      const parts = [px ? `${px} ${u} left and right` : "", py ? `${py} ${u} top and bottom` : ""].filter(Boolean).join(", ");
      it.fixTarget = `Grow the tap area to ${reqT} × ${reqT} ${u}${parts ? ": add " + parts : ""}. The visible shape can stay the same size.`;
    }
    items.push(it);
  });

  const WT = { colour: ["Colour as the only signal", "1.4.1"], placeholder: ["Placeholder as the only label", "3.3.2"], disabled: ["Disabled state", "1.4.3"] } as const;
  for (const w of raw.warnings) {
    const [check, r] = WT[w.type];
    items.push({ id: "w" + id++, kind: "warn", group: "warn", check, element: w.element, note: w.note, box: w.box, rule: "WCAG " + r, ruleUrl: RULES[r] });
  }

  const order = { fail: 0, manual: 1, warn: 2, pass: 3 }, korder = { contrast: 0, nontext: 1, target: 2, warn: 3 };
  items.sort((a, b) => order[a.group] - order[b.group] || korder[a.kind] - korder[b.kind] || (a.ratio ?? 99) - (b.ratio ?? 99));
  let n = 0;
  for (const it of items) if (it.group !== "pass") it.n = ++n;
  return items;
}

export interface Counts {
  contrast: number;
  target: number;
  manual: number;
  warn: number;
  pass: number;
  fail: number;
}

export function countFindings(items: Finding[]): Counts {
  const f = items.filter((i) => i.group === "fail");
  return {
    contrast: f.filter((i) => i.kind === "contrast" || i.kind === "nontext").length,
    target: f.filter((i) => i.kind === "target").length,
    manual: items.filter((i) => i.group === "manual").length,
    warn: items.filter((i) => i.group === "warn").length,
    pass: items.filter((i) => i.group === "pass").length,
    fail: f.length,
  };
}

export const plural = (n: number, s: string, p = s + "s") => n + " " + (n === 1 ? s : p);

export function summarise(items: Finding[]) {
  const c = countFindings(items), parts: string[] = [];
  if (c.contrast) parts.push(plural(c.contrast, "contrast fail"));
  if (c.target) parts.push(plural(c.target, "touch target fail"));
  const what = c.fail
    ? parts.join(", ")
    : c.manual
      ? "No fails, " + plural(c.manual, "result") + " to check by hand"
      : "No contrast or touch target fails";
  return { verdict: c.fail ? ("FAIL" as const) : ("PASS" as const), what, c };
}
