import { clamp } from "../colour";
import { clean, INPUT_RE, trunc } from "../analyse-svg";
import { analysePixels, refineTarget } from "../pixels";
import type { Box, Critique, RawFindings, RawText, ScreenDoc, Severity, Tone } from "../types";
import type { CritiqueResult, LocateResult } from "./schemas";

/* Turn Claude's answers into app data, dropping anything malformed. */

const SEVERITIES: Severity[] = ["high", "medium", "low"];

export function normaliseCritique(res: CritiqueResult, tone: Tone): Critique | null {
  const issues = (res.issues ?? [])
    .slice(0, 10)
    .map((i) => ({
      severity: SEVERITIES.includes(i.severity) ? i.severity : "medium",
      category: clean(i.category) || "Hierarchy",
      check: clean(i.check),
      element: clean(i.element) || "Element",
      problem: clean(i.problem),
      fix: clean(i.fix),
      principle: clean(i.principle),
      pin: { x: clamp(Number(i.pin?.x) || 0.5, 0, 1), y: clamp(Number(i.pin?.y) || 0.5, 0, 1) },
    }))
    .filter((i) => i.problem)
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
  const overall = clean(res.overall);
  if (!issues.length || !overall) return null;
  const score = (s: { score: number; why: string } | undefined) =>
    s ? { score: clamp(Math.round(Number(s.score) || 0), 0, 5), why: clean(s.why) } : undefined;
  return {
    example: false,
    tone,
    overall,
    scores: { hierarchy: score(res.scores?.hierarchy), contrast: score(res.scores?.contrast), consistency: score(res.scores?.consistency) },
    issues,
  };
}

/** Claude finds elements in an image; code then measures their pixels. */
export function findingsFromLocate(doc: ScreenDoc, res: LocateResult): RawFindings {
  const nb = (b: unknown): Box | null =>
    Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === "number" && isFinite(v))
      ? [(b[0] / 1000) * doc.W, (b[1] / 1000) * doc.H, Math.max(1, (b[2] / 1000) * doc.W), Math.max(1, (b[3] / 1000) * doc.H)]
      : null;

  const texts: RawText[] = [];
  for (const t of (res.texts ?? []).slice(0, 60)) {
    const box = nb(t.box);
    if (!box || !clean(t.text)) continue;
    const pad = box[3] * 0.25;
    const m = analysePixels(doc, [box[0] - 2, box[1] - pad, box[2] + 4, box[3] + 2 * pad]);
    const item: RawText = { label: "“" + trunc(clean(t.text)) + "”", box, bold: !!t.bold, disabled: !!t.disabled, ids: "", fontUnits: box[3] * 0.8 };
    // Cap height is roughly 0.8 of the font size, so size comes from the measured ink.
    if (m?.ink) { item.box = m.ink; item.fontUnits = m.ink[3] / 0.8; }
    if (m && m.ratio > 1) Object.assign(item, { ratio: m.ratio, fg: m.fg, bg: m.bg, varies: false });
    else item.unmeasured = "The text colour couldn't be separated from its background.";
    texts.push(item);
  }

  const targets = (res.targets ?? [])
    .slice(0, 40)
    .map((t) => {
      const box = nb(t.box);
      return box ? { label: trunc(clean(t.label) || "Control", 40), box: refineTarget(doc, box), input: INPUT_RE.test(t.label || "") } : null;
    })
    .filter((t): t is NonNullable<typeof t> => !!t);

  const warnings = (res.warnings ?? [])
    .slice(0, 12)
    .filter((w) => ["colour", "placeholder", "disabled"].includes(w.type))
    .map((w) => ({ type: w.type, element: trunc(clean(w.element) || "Element", 50), note: clean(w.note), box: nb(w.box) }));

  return { estimated: true, texts, strokes: [], targets, warnings };
}
