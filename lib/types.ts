export type RGB = [number, number, number];
/** [x, y, width, height] in document units */
export type Box = [number, number, number, number];

export type Platform = "ios" | "android" | "web";
export type Level = "AA" | "AAA";
export type Tone = "mentor" | "blunt";
export type Mode = "a11y" | "crit";

export interface Settings {
  platform: Platform;
  scale: number;
  level: Level;
}

/** A loaded screen. Canvases hold the rendered pixels the checks sample from. */
export interface ScreenDoc {
  kind: "svg" | "raster";
  name: string;
  W: number;
  H: number;
  minX: number;
  minY: number;
  /** Canvas pixels per document unit */
  k: number;
  full: HTMLCanvasElement;
  /** SVG only: a render with every text layer hidden, used as the exact background */
  noText: HTMLCanvasElement | null;
  fullData: ImageData;
  noTextData: ImageData | null;
  url: string;
  svgEl?: SVGSVGElement;
  mount?: HTMLElement;
  file?: File;
}

export interface RawText {
  label: string;
  box: Box;
  fontUnits: number;
  bold: boolean;
  disabled: boolean;
  ids: string;
  ratio?: number;
  fg?: RGB;
  bg?: RGB;
  varies?: boolean;
  unmeasured?: string;
}

export interface RawStroke {
  label: string;
  box: Box;
  fg: RGB;
  bg: RGB;
  ratio: number;
}

export interface RawTarget {
  label: string;
  box: Box;
  input: boolean;
  disabled?: boolean;
}

export type WarningType = "colour" | "placeholder" | "disabled";

export interface RawWarning {
  type: WarningType;
  element: string;
  note: string;
  box: Box | null;
}

/** What the analysers found, before it is judged against a level */
export interface RawFindings {
  estimated: boolean;
  texts: RawText[];
  strokes: RawStroke[];
  targets: RawTarget[];
  warnings: RawWarning[];
}

export type Group = "fail" | "manual" | "warn" | "pass";
export type Kind = "contrast" | "nontext" | "target" | "warn";

export interface Finding {
  id: string;
  kind: Kind;
  group: Group;
  check: string;
  element: string;
  box?: Box | null;
  rule?: string;
  ruleUrl?: string;
  estimated?: boolean;
  fg?: RGB;
  bg?: RGB;
  ratio?: number;
  measured?: string;
  required?: string;
  sizeNote?: string;
  fixHex?: string;
  fixRatio?: string;
  fixText?: string;
  fixTarget?: string;
  note?: string;
  /** Display number for non-passing findings */
  n?: number;
}

export interface Measurement {
  id: string;
  box: Box;
  ratio: number;
  fg: RGB;
  bg: RGB;
}

export type Severity = "high" | "medium" | "low";

export interface CritiqueIssue {
  severity: Severity;
  category: string;
  check: string;
  element: string;
  problem: string;
  fix: string;
  principle: string;
  pin: { x: number; y: number };
}

export interface CritiqueScore {
  score: number;
  why: string;
}

export interface Critique {
  example: boolean;
  tone: Tone;
  overall: string;
  scores: Partial<Record<"hierarchy" | "contrast" | "consistency", CritiqueScore>>;
  issues: CritiqueIssue[];
}
