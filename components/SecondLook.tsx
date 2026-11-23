"use client";

import { useEffect, useRef, useState } from "react";
import { UNITS } from "@/lib/rules";
import type { Level, Platform } from "@/lib/types";
import { A11yPanel } from "./A11yPanel";
import { Segmented } from "./Bits";
import { CritiquePanel } from "./CritiquePanel";
import { KeyDialog } from "./KeyDialog";
import { useSecondLook } from "./useSecondLook";
import { Viewer } from "./Viewer";
import { countFindings } from "@/lib/evaluate";

const SCALES = [1, 2, 2.625, 3];

export function SecondLook() {
  const s = useSecondLook();
  const panel = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [keyOpen, setKeyOpen] = useState(false);

  // Paste a screenshot straight in.
  const { openFile } = s;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (f) openFile(f);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [openFile]);

  const pick = (id: string) => {
    s.setHotId(id);
    const el = panel.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    if (el) {
      const details = el.closest("details");
      if (details) details.open = true;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const c = countFindings(s.items);
  const u = UNITS[s.platform];
  const scales = SCALES.includes(s.scale) ? SCALES : [...SCALES, s.scale].sort((a, b) => a - b);
  const a11y = s.mode === "a11y";
  const dialogOpen = keyOpen || !!s.keyPrompt;

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>Second Look<span className="dot" aria-hidden="true" /></h1>
          <p>Accessibility checks and a design critique for one screen</p>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => fileInput.current?.click()}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v3h11v-3" /></svg>
            Upload screen
          </button>
          <input
            ref={fileInput}
            type="file"
            className="sr"
            tabIndex={-1}
            aria-hidden="true"
            accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
            onChange={(e) => { s.openFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          <button className="btn" type="button" onClick={s.loadSample}>Load sample</button>
          <button className="btn keychip" type="button" onClick={() => setKeyOpen(true)}>
            {s.apiKey && <span className="dotk" aria-hidden="true" />}
            {s.apiKey ? "Your key" : "API key"}
          </button>
        </div>
      </header>

      <main className="layout">
        <Viewer s={s} onPick={pick} />

        <div className="panel" ref={panel}>
          <div className="card settings" aria-label="Settings">
            <div className="field">
              <span className="lbl" id="platL">Platform</span>
              <Segmented<Platform>
                labelledBy="platL"
                value={s.platform}
                onChange={s.setPlatform}
                options={[{ v: "ios", label: "iOS" }, { v: "android", label: "Android" }, { v: "web", label: "Web" }]}
              />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="scale">Scale</label>
              <select id="scale" value={String(s.scale)} onChange={(e) => s.setScale(Number(e.target.value) || 1)}>
                {scales.map((v) => <option key={v} value={String(v)}>{v}x</option>)}
              </select>
            </div>
            <div className="field">
              <span className="lbl" id="lvlL">WCAG 2.2</span>
              <Segmented<Level> labelledBy="lvlL" value={s.level} onChange={s.setLevel} options={[{ v: "AA", label: "AA" }, { v: "AAA", label: "AAA" }]} />
            </div>
            <div className="field wide">
              <label className="lbl" htmlFor="context">What the screen is for</label>
              <input type="text" id="context" maxLength={300} value={s.context} onChange={(e) => s.setContext(e.target.value)} placeholder="For example: checkout for first-time buyers" />
              <span className="hint">
                {s.doc?.kind === "svg"
                  ? `Scale is image units per ${u}. Figma SVG exports at 1x.`
                  : `Scale is image pixels per ${u}. iPhone screenshots are usually 3x, Android 2.625x.`}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="tabs" role="tablist">
              <button role="tab" type="button" id="tab-a11y" aria-controls="pane-a11y" aria-selected={a11y} onClick={() => s.setMode("a11y")}>
                Accessibility{" "}
                {s.raw && <span className={"cnt" + (c.fail ? " bad" : "")}>{c.fail ? `${c.fail} fail${c.fail === 1 ? "" : "s"}` : "pass"}</span>}
              </button>
              <button role="tab" type="button" id="tab-crit" aria-controls="pane-crit" aria-selected={!a11y} onClick={() => { s.setMode("crit"); s.setMeasuring(false); }}>
                Critique {s.crit && <span className="cnt">{s.crit.issues.length} points</span>}
              </button>
            </div>
            <div className="pane" id="pane-a11y" role="tabpanel" aria-labelledby="tab-a11y" hidden={!a11y}>
              <A11yPanel s={s} />
            </div>
            <div className="pane" id="pane-crit" role="tabpanel" aria-labelledby="tab-crit" hidden={a11y}>
              <CritiquePanel s={s} />
            </div>
          </div>

          <div className="card exports">
            <span className="lbl">Export</span>
            <button className="btn" type="button" disabled={!s.doc} onClick={() => s.exportAs("md")}>Report .md</button>
            <button className="btn" type="button" disabled={!s.doc} onClick={() => s.exportAs("pdf")}>Report .pdf</button>
            <button className="btn" type="button" disabled={!s.doc} onClick={() => s.exportAs("png")}>Overlay .png</button>
          </div>
        </div>
      </main>

      <footer className="foot-note">
        <span>Contrast and target sizes are measured in your browser. Only the critique and image checks send the screen to Claude.</span>
        <a href="https://github.com/tlowndes/second-look" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
      </footer>

      <KeyDialog
        open={dialogOpen}
        reason={s.keyPrompt?.reason ?? null}
        hasKey={!!s.apiKey}
        onSubmit={(k, remember) => {
          setKeyOpen(false);
          if (s.keyPrompt) s.submitKey(k, remember);
          else { s.saveKey(k, remember); s.toast("Key saved. Runs now use your account."); }
        }}
        onForget={() => { s.saveKey(null, false); setKeyOpen(false); s.setKeyPrompt(null); s.toast("Key forgotten."); }}
        onClose={() => { setKeyOpen(false); s.setKeyPrompt(null); }}
      />
      <div className="toast" role="status" aria-live="polite" hidden={!s.toastMsg}>{s.toastMsg}</div>
    </div>
  );
}
