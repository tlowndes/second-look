import { clamp } from "../colour";
import type { Box, Critique, Finding, ScreenDoc } from "../types";

/* Draw the screen with its findings or critique pins, for the PNG and PDF exports. */

export function overlayCanvas(doc: ScreenDoc, mode: "a11y" | "crit", items: Finding[], crit: Critique | null, maxW = 1200) {
  const src = doc.full, s = Math.min(1, maxW / src.width);
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  const x = c.getContext("2d")!;
  x.drawImage(src, 0, 0, c.width, c.height);
  const f = c.width / doc.W, lw = Math.max(2, c.width / 260);
  const P = (b: Box) => [(b[0] - doc.minX) * f, (b[1] - doc.minY) * f, b[2] * f, b[3] * f] as const;
  const tag = (t: string, bx: number, by: number, bg: string, fg: string) => {
    x.font = `600 ${Math.max(11, lw * 5)}px monospace`;
    const w = x.measureText(t).width + lw * 3, h = Math.max(14, lw * 7);
    x.fillStyle = bg;
    x.fillRect(bx - lw / 2, by - h, w, h);
    x.fillStyle = fg;
    x.textBaseline = "middle";
    x.fillText(t, bx + lw, by - h / 2);
  };

  if (mode === "a11y") {
    const col = { fail: "#FF2E3B", manual: "#FFA41B", warn: "#9B6BFF", pass: "#2E7BFF" };
    for (const it of items) {
      if (!it.box || (it.group === "pass" && it.kind !== "target")) continue;
      const [bx, by, bw, bh] = P(it.box);
      x.lineWidth = lw;
      x.strokeStyle = "rgba(255,255,255,.9)";
      x.setLineDash([]);
      x.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
      x.strokeStyle = col[it.group];
      x.setLineDash(it.group === "fail" ? [] : [lw * 2.5, lw * 1.5]);
      x.strokeRect(bx, by, bw, bh);
      if (it.n) {
        x.setLineDash([]);
        tag(String(it.n), bx, by, col[it.group], it.group === "manual" ? "#1d1300" : "#fff");
      }
    }
  } else if (crit) {
    const col = { high: "#C62830", medium: "#B36200", low: "#3D4756" }, r = Math.max(12, c.width / 32);
    crit.issues.forEach((it, i) => {
      const px = clamp(it.pin.x, 0.02, 0.98) * c.width, py = clamp(it.pin.y, 0.02, 0.98) * c.height;
      x.beginPath();
      x.arc(px, py, r, 0, Math.PI * 2);
      x.fillStyle = col[it.severity];
      x.fill();
      x.lineWidth = lw;
      x.strokeStyle = "#fff";
      x.stroke();
      x.fillStyle = "#fff";
      x.font = `700 ${r}px sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(String(i + 1), px, py + 1);
      x.textAlign = "start";
    });
  }
  return c;
}
