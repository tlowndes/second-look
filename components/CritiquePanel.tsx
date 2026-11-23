"use client";

import { clamp } from "@/lib/colour";
import { PRINCIPLES } from "@/lib/rules";
import { Segmented, Spinner } from "./Bits";
import { critKey, type SecondLook } from "./useSecondLook";

const SEV = { high: "High", medium: "Medium", low: "Low" };

export function CritiquePanel({ s }: { s: SecondLook }) {
  const { doc, crit, critState, critErr, thumbs } = s;
  if (!doc) return null;

  const keys = (crit?.issues ?? []).map((it) => critKey(doc.name, it));
  const rated = keys.filter((k) => thumbs[k]);
  const up = rated.filter((k) => thumbs[k] === "up").length;
  const usingOwnKey = !!s.apiKey;

  return (
    <>
      <div className="row">
        <span className="lbl">Tone</span>
        <Segmented
          label="Tone"
          value={s.tone}
          onChange={s.setTone}
          options={[{ v: "mentor", label: "Friendly mentor" }, { v: "blunt", label: "Blunt senior" }]}
        />
      </div>
      <details className="tk" open={!!s.tokens || undefined}>
        <summary>Design tokens (optional)</summary>
        <div className="field" style={{ marginTop: 8 }}>
          <label className="hint" htmlFor="tokens">Paste colours, type scale and spacing so consistency checks use your real system.</label>
          <textarea
            id="tokens"
            value={s.tokens}
            maxLength={4000}
            onChange={(e) => s.setTokens(e.target.value)}
            placeholder={"--blue-600: #2F6FED\ntype: 13 / 15 / 17 / 20 / 28\nspacing: 4, 8, 12, 16, 24, 32"}
          />
        </div>
      </details>

      {critState === "running" ? (
        <div className="callout">
          <div className="thinking"><Spinner />Claude is reviewing hierarchy, contrast and consistency. This usually takes under a minute.</div>
          <div className="row"><button className="btn" type="button" onClick={s.stop}>Stop</button></div>
        </div>
      ) : (
        <>
          <div className="row">
            <button className="btn primary" type="button" onClick={() => s.runCritique()}>
              {crit && !crit.example ? "Run again" : "Run critique"}
            </button>
            <span className="hint">{usingOwnKey ? "Uses your API key." : s.hosted === false ? "Needs your own Anthropic API key." : "Free runs each day, or use your own key."}</span>
          </div>
          {critState === "error" && <div className="callout err"><p>{critErr}</p></div>}
        </>
      )}

      {crit ? (
        <>
          {crit.example && <div className="banner">Example critique of the sample screen. Upload your own screen and press Run critique for a live one.</div>}
          <div className="group">
            <h3>Overall read</h3>
            <p className="overall">{crit.overall}</p>
          </div>
          <div className="scores">
            {(["hierarchy", "contrast", "consistency"] as const).map((key) => {
              const sc = crit.scores[key];
              const v = clamp(Math.round(sc?.score ?? 0), 0, 5);
              return (
                <div className="score" key={key}>
                  <span className="t">{key[0].toUpperCase() + key.slice(1)}</span>
                  <span className="v">{v}<small>/5</small></span>
                  <div className="meter" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? "on" : ""} />)}</div>
                  <span className="why">{sc?.why}</span>
                </div>
              );
            })}
          </div>
          <div className="group">
            <h3>Issues ({crit.issues.length})</h3>
            <ul className="list">
              {crit.issues.map((it, i) => {
                const pr = PRINCIPLES[(it.check || "").toLowerCase()];
                const key = critKey(doc.name, it), t = thumbs[key], id = "p" + i;
                return (
                  <li key={id} className={"ci" + (s.hotId === id ? " hot" : "")} data-id={id} onMouseEnter={() => s.setHotId(id)} onMouseLeave={() => s.setHotId(null)}>
                    <span className={`pn s-${it.severity}`}>{i + 1}</span>
                    <div>
                      <div className="r1">
                        <span className={`sev s-${it.severity}`}>{SEV[it.severity]}</span>
                        <span className="rule">{it.category} · {it.check}</span>
                      </div>
                      <div className="el">{it.element}</div>
                      <p>{it.problem}</p>
                      <div className="fx"><b>Fix:</b> {it.fix}</div>
                      <div className="foot">
                        <span className="why">
                          {pr ? (
                            <a href={pr[1]} target="_blank" rel="noopener noreferrer">Why: {it.principle || pr[0]} ↗</a>
                          ) : (
                            it.principle && <span className="hint">Why: {it.principle}</span>
                          )}
                        </span>
                        <span className="thumbs" role="group" aria-label="Was this useful?">
                          <button type="button" aria-pressed={t === "up"} onClick={() => s.setThumb(key, "up")}>Useful</button>
                          <button type="button" aria-pressed={t === "down"} onClick={() => s.setThumb(key, "down")}>Not useful</button>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="hint">{rated.length ? `You rated ${up} of ${rated.length} points useful.` : "Rate each point so you can track how useful the critique is."}</p>
        </>
      ) : (
        critState !== "running" && (
          <p className="hint">The critique reads the screen like a senior designer: an overall read, scores for hierarchy, contrast and consistency, and a ranked list of issues with fixes, pinned to the screen.</p>
        )
      )}
    </>
  );
}
