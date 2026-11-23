import { PLATFORM_NAME, UNITS } from "../rules";
import type { CritiqueRequest, LocateRequest } from "./schemas";

/* Prompts live on the server, so the hosted key only ever runs these two jobs. */

export function locatePrompt(r: LocateRequest) {
  return `You are helping an accessibility checker read a UI mockup. Code will measure colours and sizes, so your job is only to find elements and give their positions.
The image is ${Math.round(r.width)} x ${Math.round(r.height)} pixels. Platform: ${PLATFORM_NAME[r.platform]}.${r.context ? " The screen is for: " + r.context + "." : ""}
Give every box as [x, y, width, height] on a 0 to 1000 scale of the image's width (x, width) and height (y, height). Make text boxes tight around each line of text.
Find:
1. "texts": every separate line or label of visible text, up to 50. Mark "bold" true for bold or semibold text, and "disabled" true for text on a visibly disabled control.
2. "targets": every tappable element: buttons, icon buttons, links, tabs, inputs, toggles, checkboxes, radio buttons, steppers. Give the visible bounds of each control.
3. "warnings": only real cases of these types: "colour" (colour is the only signal, for example red error text with no icon or label), "placeholder" (placeholder text is the only label of a field), "disabled" (a disabled state shown only by low contrast). Each note is one short sentence. Leave the list empty if there are none.`;
}

export function critiquePrompt(r: CritiqueRequest) {
  const tone =
    r.tone === "blunt"
      ? "Blunt senior designer: direct, short sentences, no softening, no praise unless it's earned."
      : "Friendly mentor: warm and clear, say what works before what doesn't, explain the why in plain words.";
  const measured = r.measured.map((m) => "- " + m).join("\n");
  return `You are a senior product designer giving a critique of one static UI screen (attached image, ${Math.round(r.width)} x ${Math.round(r.height)}).
Tone: ${tone}
Platform: ${PLATFORM_NAME[r.platform]}. ${r.context ? "What the screen is for: " + r.context + "." : "No context given; infer it from the screen."}
${r.tokens ? "The team's design tokens (use these for consistency checks):\n" + r.tokens + "\n" : ""}${measured ? "Code-measured accessibility fails on this screen (trust these numbers):\n" + measured + "\n" : ""}
Judge three categories and only these checks:
- Hierarchy: One clear focal point, Reading order, Type scale, Grouping
- Contrast: Text against background, Emphasis contrast, Density
- Consistency: Spacing rhythm, Colour use, Components, Alignment, Platform conventions
Rules: every issue names a specific visible element, what is wrong and a concrete fix with values where you can (sizes in ${UNITS[r.platform]}, spacing, hex colours). Never give vague advice such as "consider improving the layout". Severity: high = blocks the task or hides the main action; medium = slows the user or weakens the hierarchy; low = polish. Give 4 to 8 issues, most severe first. Use UK spelling.
"overall" is two sentences: what works, then the one biggest problem. Each score is 1 to 5 with a one-line "why". "problem" and "fix" are one or two sentences each. "principle" is the short name of the design principle behind the issue. "pin" is the centre of the element as a fraction of the image width (x) and height (y), from 0 to 1.`;
}
