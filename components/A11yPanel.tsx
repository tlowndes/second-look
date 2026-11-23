"use client";

import { formatRatio, hex2rgb, rgb2hex } from "@/lib/colour";
import { plural, summarise } from "@/lib/evaluate";
import { PLATFORM_NAME, UNITS } from "@/lib/rules";
import type { Finding, Group, Measurement } from "@/lib/types";
import { Aa, Spinner, Swatch } from "./Bits";
import type { SecondLook } from "./useSecondLook";

const fmtN = (v: number) => (Math.round(v * 10) / 10).toString();

function FindingItem({ it, s, copy }: { it: Finding; s: SecondLook; copy: (h: string) => void }) {
  return (
    <li className={`item g-${it.group}${s.hotId === it.id ? " hot" : ""}`} data-id={it.id} onMouseEnter={() => s.setHotId(it.id)} onMouseLeave={() => s.setHotId(null)}>
      <span className="num">{it.n ?? "✓"}</span>
      <div>
        <div className="r1">
          <span className="check">{it.check}</span>
          {it.rule && (
            <a className="rule" href={it.ruleUrl} target="_blank" rel="noopener noreferrer">
              {it.rule} ↗
            </a>
          )}
        </div>
        <div className="el">{it.element}</div>
        {it.ratio != null && it.fg && it.bg ? (
          <div className="vals">
            <Aa fg={it.fg} bg={it.bg} />
            <span className="mono meas">{it.measured}</span>
            <span className="mono req">needs {it.required}</span>
            {it.sizeNote && <span className="mono req">{it.sizeNote}</span>}
            {it.estimated && <span className="pill">estimated</span>}
          </div>
        ) : it.measured ? (
          <div className="vals">
            <span className="mono meas">{it.measured}</span>
            {it.required && <span className="mono req">needs {it.required}</span>}
            {it.estimated && <span className="pill">estimated</span>}
          </div>
        ) : null}
        {it.fixHex && (
          <div className="fix">
            <b>Fix:</b> {it.kind === "nontext" ? "change the colour to" : "change the text to"} <Swatch c={hex2rgb(it.fixHex)} onCopy={copy} />
            <span className="mono req">{it.fixRatio}</span>
            {it.fixText && <span className="req">{it.fixText}</span>}
          </div>
        )}
        {it.fixTarget && (
          <div className="fix">
            <span><b>Fix:</b> {it.fixTarget}</span>
          </div>
        )}
        {it.note && <div className="note">{it.note}</div>}
      </div>
    </li>
  );
}

function MeasureItem({ m, i, s, copy }: { m: Measurement; i: number; s: SecondLook; copy: (h: string) => void }) {
  const u = UNITS[s.platform], AA = s.level === "AA";
  const ok = (t: number) => (
    <span className="mono" style={{ color: m.ratio >= t ? "var(--pass)" : "var(--fail)" }}>{m.ratio >= t ? "pass" : "fail"}</span>
  );
  return (
    <li className={`item g-measure${s.hotId === m.id ? " hot" : ""}`} data-id={m.id} onMouseEnter={() => s.setHotId(m.id)} onMouseLeave={() => s.setHotId(null)}>
      <span className="num">M{i + 1}</span>
      <div>
        <div className="r1">
          <span className="check">Your measurement</span>
          <button className="x" type="button" aria-label="Remove measurement" onClick={() => s.removeMeasure(m.id)}>×</button>
        </div>
        <div className="vals">
          <Aa fg={m.fg} bg={m.bg} />
          <span className="mono meas">{formatRatio(m.ratio)}</span>
          <span className="mono req">{fmtN(m.box[2] / s.scale)} × {fmtN(m.box[3] / s.scale)} {u}</span>
        </div>
        <div className="vals">
          <span className="req">Body text</span>{ok(AA ? 4.5 : 7)}
          <span className="req">Large text</span>{ok(AA ? 3 : 4.5)}
          <span className="req">Non-text</span>{ok(3)}
        </div>
        <div className="fix">
          <Swatch c={m.fg} label={"Text " + rgb2hex(m.fg)} onCopy={copy} />
          <Swatch c={m.bg} label={"Background " + rgb2hex(m.bg)} onCopy={copy} />
        </div>
      </div>
    </li>
  );
}

export function A11yPanel({ s }: { s: SecondLook }) {
  const { doc, raw, items, a11yState, a11yErr, measures } = s;
  const copy = async (hex: string) => {
    try { await navigator.clipboard.writeText(hex); s.toast("Copied " + hex); } catch { s.toast(hex); }
  };
  if (!doc) return null;

  const meas = measures.length > 0 && (
    <div className="group">
      <h3>Your measurements</h3>
      <ul className="list">{measures.map((m, i) => <MeasureItem key={m.id} m={m} i={i} s={s} copy={copy} />)}</ul>
    </div>
  );

  if (doc.kind === "raster" && a11yState !== "done") {
    return (
      <>
        {a11yState === "running" ? (
          <div className="callout">
            <div className="thinking"><Spinner />Claude is finding text and controls. The measuring is done in code after that. This usually takes 20 to 60 seconds.</div>
            <div className="row"><button className="btn" type="button" onClick={s.stop}>Stop</button></div>
          </div>
        ) : (
          <div className={"callout" + (a11yState === "error" ? " err" : "")}>
            {a11yState === "error" ? (
              <p>{a11yErr}</p>
            ) : (
              <p><b>Images give estimated results.</b> Claude finds the text and controls, then code samples the pixels to measure contrast and size. Results within 0.3 of a threshold go to “check by hand”.</p>
            )}
            <div className="row">
              <button className="btn primary" type="button" onClick={() => s.runImageChecks()}>{a11yState === "error" ? "Try again" : "Run checks"}</button>
              <span className="hint">For exact numbers, upload an SVG export.</span>
            </div>
          </div>
        )}
        {meas}
      </>
    );
  }

  if (a11yState === "error" || !raw) {
    return (
      <>
        <div className="callout err"><p>{a11yErr || "Nothing to show yet."}</p></div>
        {meas}
      </>
    );
  }

  const { verdict, what, c } = summarise(items);
  const sub = [c.manual && c.manual + " to check by hand", c.warn && plural(c.warn, "warning"), plural(c.pass, "pass", "passes")].filter(Boolean).join(" · ");
  const lvl = `WCAG 2.2 ${s.level} · ${PLATFORM_NAME[s.platform]} · ${raw.estimated ? "estimated from pixels" : "exact from layers"}`;
  const group = (g: Group, title: string, colour: string) => {
    const list = items.filter((i) => i.group === g);
    return list.length ? (
      <div className="group">
        <h3><span className="dotc" style={{ background: colour }} />{title} ({list.length})</h3>
        <ul className="list">{list.map((it) => <FindingItem key={it.id} it={it} s={s} copy={copy} />)}</ul>
      </div>
    ) : null;
  };
  const passes = items.filter((i) => i.group === "pass");

  return (
    <>
      <div className={`verdict ${verdict === "FAIL" ? "fail" : "pass"}`}>
        <span className="stamp">{verdict}</span>
        <div>
          <div className="what">{what}</div>
          <div className="sub">{sub}</div>
          <div className="sub">{lvl}</div>
        </div>
      </div>
      {meas}
      {group("fail", "Fails", "var(--fail)")}
      {group("manual", "Check by hand", "var(--manual)")}
      {group("warn", "Warnings", "var(--warn)")}
      {!raw.targets.length && (
        <div className="callout"><p>No tappable layers were found. Name layers with words like Button, Link, Tab or Input so the checker can find them, or measure a control by hand with Measure.</p></div>
      )}
      {passes.length > 0 && (
        <details className="passes">
          <summary>Passes ({passes.length})</summary>
          <ul className="list">{passes.map((it) => <FindingItem key={it.id} it={it} s={s} copy={copy} />)}</ul>
        </details>
      )}
      <p className="hint">
        {doc.kind === "svg"
          ? "Exact results use the colours and sizes in the SVG. Export with “Outline text” off and “Include id attribute” on, so text and layer names come through."
          : "Estimated results come from sampled pixels. Upload an SVG export for exact numbers."}{" "}
        Not a WCAG certification: screen reader, keyboard and focus order need built code.
      </p>
    </>
  );
}
