"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { clamp } from "@/lib/colour";
import type { Box, ScreenDoc } from "@/lib/types";
import type { SecondLook } from "./useSecondLook";

const pos = (d: ScreenDoc, b: Box): CSSProperties => ({
  left: `${(((b[0] - d.minX) / d.W) * 100).toFixed(3)}%`,
  top: `${(((b[1] - d.minY) / d.H) * 100).toFixed(3)}%`,
  width: `${((b[2] / d.W) * 100).toFixed(3)}%`,
  height: `${((b[3] / d.H) * 100).toFixed(3)}%`,
});

export function Viewer({ s, onPick }: { s: SecondLook; onPick: (id: string) => void }) {
  const { doc, mode, items, measures, crit, showPasses, measuring, hotId, setHotId } = s;
  const stage = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ start: [number, number]; box?: Box } | null>(null);
  const [dropping, setDropping] = useState(false);

  const toDoc = (ev: PointerEvent): [number, number] => {
    const r = stage.current!.getBoundingClientRect(), d = doc!;
    return [d.minX + clamp((ev.clientX - r.left) / r.width, 0, 1) * d.W, d.minY + clamp((ev.clientY - r.top) / r.height, 0, 1) * d.H];
  };
  const canMeasure = measuring && !!doc && mode === "a11y";

  const badge = !doc ? null : s.isSample
    ? { cls: "badge sample", text: "Sample · SVG layers" }
    : doc.kind === "svg" ? { cls: "badge exact", text: "Exact · SVG layers" } : { cls: "badge est", text: "Estimated · image" };

  const hover = (id: string) => ({
    onMouseEnter: () => setHotId(id),
    onMouseLeave: () => setHotId(null),
    onClick: () => !measuring && onPick(id),
  });

  return (
    <section className="viewer" aria-label="Screen">
      <div className="vhead">
        <div className="fname">
          <span className="n">{doc?.name ?? "No screen"}</span>
          {badge && <span className={badge.cls}>{badge.text}</span>}
        </div>
        {mode === "a11y" && (
          <div className="tool">
            <button className="toggle" type="button" aria-pressed={measuring} title="Drag a box on the screen to measure contrast and size" onClick={() => s.setMeasuring(!measuring)}>
              Measure
            </button>
            <button className="toggle" type="button" aria-pressed={showPasses} onClick={() => s.setShowPasses(!showPasses)}>
              Show passes
            </button>
          </div>
        )}
      </div>

      <div
        className={"canvas" + (dropping ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => { e.preventDefault(); setDropping(false); s.openFile(e.dataTransfer.files[0]); }}
      >
        {!doc ? (
          <div className="empty">Loading the sample screen…</div>
        ) : (
          <div
            ref={stage}
            className={"stage" + (canMeasure ? " measuring" : "")}
            style={{ "--ar": (doc.W / doc.H).toFixed(5) } as CSSProperties}
            onPointerDown={(ev) => {
              if (!canMeasure) return;
              ev.preventDefault();
              stage.current!.setPointerCapture(ev.pointerId);
              setDrag({ start: toDoc(ev) });
            }}
            onPointerMove={(ev) => {
              if (!drag) return;
              const p = toDoc(ev), st = drag.start;
              setDrag({ ...drag, box: [Math.min(st[0], p[0]), Math.min(st[1], p[1]), Math.abs(p[0] - st[0]), Math.abs(p[1] - st[1])] });
            }}
            onPointerUp={() => {
              const b = drag?.box;
              setDrag(null);
              if (b && b[2] >= 2 && b[3] >= 2) s.addMeasure(b);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not a remote image */}
            <img src={doc.url} alt="The uploaded screen" draggable={false} />
            <div className="ov">
              {mode === "a11y" &&
                items.map((it) => {
                  if (!it.box) return null;
                  if (it.group === "pass" && !(it.kind === "target" || showPasses)) return null;
                  return (
                    <div key={it.id} className={`box g-${it.group}${hotId === it.id ? " hot" : ""}`} style={pos(doc, it.box)} title={`${it.check}: ${it.element}`} {...hover(it.id)}>
                      {it.n && <span className="tag">{it.n}</span>}
                    </div>
                  );
                })}
              {mode === "a11y" &&
                measures.map((m, i) => (
                  <div key={m.id} className={`box g-measure${hotId === m.id ? " hot" : ""}`} style={pos(doc, m.box)} {...hover(m.id)}>
                    <span className="tag">M{i + 1}</span>
                  </div>
                ))}
              {mode === "crit" &&
                crit?.issues.map((it, i) => (
                  <div
                    key={i}
                    className={`pin s-${it.severity}${hotId === "p" + i ? " hot" : ""}`}
                    style={{ left: `${clamp(it.pin.x, 0.02, 0.98) * 100}%`, top: `${clamp(it.pin.y, 0.02, 0.98) * 100}%` }}
                    title={it.element}
                    {...hover("p" + i)}
                  >
                    {i + 1}
                  </div>
                ))}
            </div>
            {drag?.box && <div className="drawing" style={pos(doc, drag.box)} />}
          </div>
        )}
      </div>

      <div className="vfoot">
        {measuring && mode === "a11y" ? (
          "Drag a box over any text or control to measure its contrast and size."
        ) : mode === "a11y" ? (
          <div className="legend">
            <span><i style={{ borderColor: "var(--ov-fail)" }} />Fail</span>
            <span><i style={{ borderColor: "var(--ov-manual)", borderStyle: "dashed" }} />Check by hand</span>
            <span><i style={{ borderColor: "var(--ov-warn)", borderStyle: "dotted" }} />Warning</span>
            <span><i style={{ borderColor: "var(--ov-target)", borderStyle: "dashed" }} />Touch target that passes</span>
          </div>
        ) : crit ? (
          "Pins match the numbered points in the critique. Hover either to link them."
        ) : (
          "Pins appear here once the critique runs."
        )}
      </div>
    </section>
  );
}
