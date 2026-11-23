import { countFindings, summarise } from "../evaluate";
import { PLATFORM_NAME, UNITS } from "../rules";
import type { Critique, Finding, RawFindings, ScreenDoc, Settings } from "../types";
import { overlayCanvas } from "./overlay";

/* Markdown and PDF reports. Plain and neutral, so they can go straight into a ticket or a portfolio. */

export interface ReportInput {
  doc: ScreenDoc;
  settings: Settings;
  raw: RawFindings | null;
  items: Finding[];
  crit: Critique | null;
  date?: Date;
}

const SEV = { high: "High", medium: "Medium", low: "Low" };
const DISCLAIMER = "Catches common visual issues only. Not a WCAG certification: screen reader, keyboard and focus order need testing in built code.";
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const fixText = (i: Finding) => (i.fixHex ? `Use ${i.fixHex} (${i.fixRatio})` : i.fixTarget ?? "");

export function reportMarkdown({ doc, settings, raw, items, crit, date = new Date() }: ReportInput): string {
  const L: string[] = [];
  const { verdict, what } = summarise(items);
  L.push(
    "# Second Look report", "",
    `Screen: ${doc.name}  `,
    `Date: ${fmtDate(date)}  `,
    `Checked against: WCAG 2.2 ${settings.level}, ${PLATFORM_NAME[settings.platform]} (${UNITS[settings.platform]}, ${settings.scale}x)  `,
    `Source: ${raw?.estimated ? "estimated from image pixels" : "exact from SVG layers"}`, "",
  );
  if (raw) {
    L.push(`## Accessibility: ${verdict}`, "", what + ".", "");
    const table = (g: Finding["group"], title: string) => {
      const list = items.filter((i) => i.group === g);
      if (!list.length) return;
      L.push(`### ${title}`, "", "| # | Check | Element | Measured | Required | Rule | Fix |", "|---|---|---|---|---|---|---|");
      for (const i of list) {
        L.push(`| ${i.n ?? ""} | ${i.check} | ${i.element.replace(/\|/g, "/")} | ${i.measured ?? ""} | ${i.required ?? ""} | ${i.rule ?? ""} | ${fixText(i)} |`);
      }
      L.push("");
    };
    table("fail", "Fails");
    table("manual", "Check by hand");
    const warns = items.filter((i) => i.group === "warn");
    if (warns.length) {
      L.push("### Warnings", "");
      for (const w of warns) L.push(`- **${w.check}**, ${w.element}${w.measured ? " (" + w.measured + ")" : ""}: ${w.note}`);
      L.push("");
    }
    L.push(`Passed: ${countFindings(items).pass} checks.`, "");
  } else L.push("## Accessibility", "", "Not run yet.", "");

  if (crit) {
    L.push(`## Critique${crit.example ? " (example)" : ""}`, "", `Tone: ${crit.tone === "blunt" ? "blunt senior" : "friendly mentor"}`, "", crit.overall, "");
    for (const [key, lab] of [["hierarchy", "Hierarchy"], ["contrast", "Contrast"], ["consistency", "Consistency"]] as const) {
      L.push(`- ${lab}: ${crit.scores[key]?.score ?? "-"}/5. ${crit.scores[key]?.why ?? ""}`);
    }
    L.push("");
    crit.issues.forEach((i, n) =>
      L.push(`${n + 1}. **[${SEV[i.severity]}] ${i.category}, ${i.check}**: ${i.element}. ${i.problem} Fix: ${i.fix}${i.principle ? " (Principle: " + i.principle + ")" : ""}`),
    );
    L.push("");
  }
  L.push(DISCLAIMER);
  return L.join("\n");
}

export async function reportPdf({ doc, settings, raw, items, crit, date = new Date() }: ReportInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14, PW = 210, PH = 297;
  let y = M;
  // The built-in PDF fonts only cover Latin-1, so strip anything they can't draw.
  const T = (s: unknown) => String(s ?? "").replace(/[↗→]/g, "").replace(/[^\x20-\x7E -ÿ“”‘’–—…·×£€]/g, "");

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(17); pdf.setTextColor(20, 24, 32);
  pdf.text("Second Look report", M, y + 5); y += 11;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(90, 99, 114);
  pdf.text(T(`${doc.name}  ·  ${fmtDate(date)}  ·  WCAG 2.2 ${settings.level}  ·  ${PLATFORM_NAME[settings.platform]} ${settings.scale}x  ·  ${raw?.estimated ? "Estimated from pixels" : "Exact from layers"}`), M, y);
  y += 6;

  const ov = overlayCanvas(doc, "a11y", items, crit, 900);
  let iw = 62, ih = (iw * ov.height) / ov.width;
  if (ih > 130) { ih = 130; iw = (ih * ov.width) / ov.height; }
  pdf.addImage(ov.toDataURL("image/png"), "PNG", M, y, iw, ih);

  const x2 = M + iw + 8, w2 = PW - M - x2;
  let y2 = y + 4;
  const { verdict, what, c } = summarise(items);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
  pdf.setTextColor(...((verdict === "FAIL" ? [185, 38, 46] : [28, 115, 66]) as [number, number, number]));
  pdf.text(raw ? verdict : "NOT RUN", x2, y2); y2 += 6;
  pdf.setFontSize(10.5); pdf.setTextColor(20, 24, 32);
  for (const l of pdf.splitTextToSize(T(raw ? what : "Accessibility checks have not been run."), w2)) { pdf.text(l, x2, y2); y2 += 5; }
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(90, 99, 114);
  if (raw) { pdf.text(T(`${c.manual} to check by hand  ·  ${c.warn} warnings  ·  ${c.pass} passes`), x2, y2); y2 += 7; }
  if (crit) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(20, 24, 32);
    pdf.text(T(`Critique${crit.example ? " (example)" : ""}`), x2, y2); y2 += 5;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    for (const l of pdf.splitTextToSize(T(crit.overall), w2)) { pdf.text(l, x2, y2); y2 += 4.3; }
    y2 += 2;
    pdf.text(T((["hierarchy", "contrast", "consistency"] as const).map((k) => `${k[0].toUpperCase() + k.slice(1)} ${crit.scores[k]?.score ?? "-"}/5`).join("   ")), x2, y2);
    y2 += 4;
  }
  y = Math.max(y + ih, y2) + 8;

  const need = (h: number) => { if (y + h > PH - M) { pdf.addPage(); y = M; } };
  const head = (t: string) => {
    need(10);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(20, 24, 32);
    pdf.text(T(t), M, y); y += 5.5;
  };
  const row = (n: string, title: string, body: string, col: [number, number, number]) => {
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(T(body), PW - 2 * M - 10);
    need(5 + lines.length * 4.1);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(...col); pdf.text(T(n), M, y);
    pdf.setTextColor(20, 24, 32); pdf.text(T(title), M + 10, y); y += 4.2;
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(70, 78, 92);
    for (const l of lines) { pdf.text(l, M + 10, y); y += 4.1; }
    y += 1.8;
  };

  const groups: [Finding["group"], string, [number, number, number]][] = [
    ["fail", "Fails", [185, 38, 46]], ["manual", "Check by hand", [153, 84, 0]], ["warn", "Warnings", [94, 67, 166]],
  ];
  for (const [g, title, col] of groups) {
    const list = items.filter((i) => i.group === g);
    if (!list.length) continue;
    head(`${title} (${list.length})`);
    for (const i of list) {
      const facts = [i.measured && `Measured ${i.measured}`, i.required && `needs ${i.required}`, i.rule].filter(Boolean).join(", ");
      const fix = i.fixHex ? `Fix: use ${i.fixHex} (${i.fixRatio}).` : i.fixTarget ? "Fix: " + i.fixTarget : "";
      row(String(i.n), `${i.check}  ·  ${i.element}`, `${facts}. ${fix}${i.note ? " " + i.note : ""}`, col);
    }
  }
  if (crit) {
    head("Critique points");
    const col = { high: [185, 38, 46], medium: [153, 84, 0], low: [76, 88, 104] } as const;
    crit.issues.forEach((i, n) =>
      row(String(n + 1), `${SEV[i.severity]}  ·  ${i.category}, ${i.check}  ·  ${i.element}`, `${i.problem} Fix: ${i.fix}`, [...col[i.severity]] as [number, number, number]),
    );
  }
  need(10);
  pdf.setFontSize(8); pdf.setTextColor(120, 128, 140);
  pdf.text(DISCLAIMER, M, Math.min(y + 4, PH - 8), { maxWidth: PW - 2 * M });
  return pdf.output("blob");
}

export const fileSlug = (s: string) =>
  String(s || "screen").replace(/\.[a-z]+$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screen";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
