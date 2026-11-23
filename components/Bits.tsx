"use client";

import { rgb2hex } from "@/lib/colour";
import type { RGB } from "@/lib/types";

export function Swatch({ c, label, onCopy }: { c: RGB | string; label?: string; onCopy: (hex: string) => void }) {
  const hex = typeof c === "string" ? c : rgb2hex(c);
  return (
    <button type="button" className="sw" title={`Copy ${hex}`} onClick={() => onCopy(hex)}>
      <i style={{ background: hex }} />
      {label ?? hex}
    </button>
  );
}

export function Aa({ fg, bg }: { fg: RGB; bg: RGB }) {
  return (
    <span className="aa" style={{ color: rgb2hex(fg), background: rgb2hex(bg) }} aria-hidden="true">
      Aa
    </span>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, labelledBy, label,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  labelledBy?: string;
  label?: string;
}) {
  return (
    <div className="seg" role="group" aria-labelledby={labelledBy} aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}

