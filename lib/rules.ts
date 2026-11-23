import type { Platform } from "./types";

const W3 = "https://www.w3.org/WAI/WCAG22/Understanding/";

export const RULES: Record<string, string> = {
  "1.4.3": W3 + "contrast-minimum.html",
  "1.4.6": W3 + "contrast-enhanced.html",
  "1.4.11": W3 + "non-text-contrast.html",
  "2.5.8": W3 + "target-size-minimum.html",
  "2.5.5": W3 + "target-size-enhanced.html",
  "1.4.1": W3 + "use-of-color.html",
  "3.3.2": W3 + "labels-or-instructions.html",
  "1.4.4": W3 + "resize-text.html",
  "Apple HIG": "https://developer.apple.com/design/human-interface-guidelines/accessibility",
  Material: "https://support.google.com/accessibility/android/answer/7101858",
};

export const UNITS: Record<Platform, string> = { ios: "pt", android: "dp", web: "px" };
export const DEFAULT_SCALE: Record<Platform, number> = { ios: 3, android: 2.625, web: 1 };
export const PLATFORM_NAME: Record<Platform, string> = { ios: "iOS", android: "Android", web: "Web" };

/** Critique checks mapped to the principle behind them, with a link for "Why". */
export const PRINCIPLES: Record<string, [string, string]> = {
  "one clear focal point": ["Visual hierarchy", "https://www.nngroup.com/articles/visual-hierarchy-ux-definition/"],
  "reading order": ["Scanning patterns", "https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/"],
  "type scale": ["Visual hierarchy", "https://www.nngroup.com/articles/visual-hierarchy-ux-definition/"],
  grouping: ["Law of proximity", "https://lawsofux.com/law-of-proximity/"],
  "text against background": ["Contrast (minimum)", W3 + "contrast-minimum.html"],
  "emphasis contrast": ["Von Restorff effect", "https://lawsofux.com/von-restorff-effect/"],
  density: ["Hick's law", "https://lawsofux.com/hicks-law/"],
  "spacing rhythm": ["Law of similarity", "https://lawsofux.com/law-of-similarity/"],
  "colour use": ["Law of similarity", "https://lawsofux.com/law-of-similarity/"],
  components: ["Consistency and standards", "https://www.nngroup.com/articles/consistency-and-standards/"],
  alignment: ["Law of Prägnanz", "https://lawsofux.com/law-of-pragnanz/"],
  "platform conventions": ["Jakob's law", "https://lawsofux.com/jakobs-law/"],
};
