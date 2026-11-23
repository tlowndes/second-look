"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyseSvg } from "@/lib/analyse-svg";
import { ClaudeError, needsOwnKey, requestCritique, requestLocate } from "@/lib/ai/client";
import { findingsFromLocate, normaliseCritique } from "@/lib/ai/normalise";
import { disposeDoc, docImageForClaude, initialScale, loadFile, loadSvgDoc } from "@/lib/doc";
import { evaluate } from "@/lib/evaluate";
import { downloadBlob, fileSlug, reportMarkdown, reportPdf } from "@/lib/export/report";
import { overlayCanvas } from "@/lib/export/overlay";
import { analysePixels } from "@/lib/pixels";
import { DEFAULT_SCALE } from "@/lib/rules";
import { SAMPLE_CRITIQUE, SAMPLE_NAME, SAMPLE_SVG } from "@/lib/sample";
import type { Box, Critique, Level, Measurement, Mode, Platform, RawFindings, ScreenDoc, Tone } from "@/lib/types";

export type A11yState = "idle" | "running" | "done" | "error";
export type CritState = "idle" | "running" | "error";
export type Thumb = "up" | "down";
type Job = "a11y" | "crit";

/* Per-viewer conveniences only. Every read and write is guarded: storage can be blocked. */
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem("sl:" + k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === undefined || v === null) localStorage.removeItem("sl:" + k);
      else localStorage.setItem("sl:" + k, JSON.stringify(v));
    } catch {}
  },
};

export const critKey = (docName: string, it: { element: string; problem: string }) =>
  docName + "|" + (it.element || "") + "|" + (it.problem || "").slice(0, 40);

export function useSecondLook() {
  const [doc, setDoc] = useState<ScreenDoc | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [raw, setRaw] = useState<RawFindings | null>(null);
  const [a11yState, setA11yState] = useState<A11yState>("idle");
  const [a11yErr, setA11yErr] = useState("");
  const [crit, setCrit] = useState<Critique | null>(null);
  const [critState, setCritState] = useState<CritState>("idle");
  const [critErr, setCritErr] = useState("");

  const [platform, setPlatformRaw] = useState<Platform>("ios");
  const [scale, setScale] = useState(1);
  const [level, setLevelRaw] = useState<Level>("AA");
  const [context, setContext] = useState("");
  const [tone, setToneRaw] = useState<Tone>("mentor");
  const [tokens, setTokens] = useState("");

  const [mode, setMode] = useState<Mode>("a11y");
  const [showPasses, setShowPasses] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measures, setMeasures] = useState<Measurement[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, Thumb>>({});
  const [hotId, setHotId] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hosted, setHosted] = useState<boolean | null>(null);
  const [keyPrompt, setKeyPrompt] = useState<{ reason: string; then: Job | null } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const ctl = useRef<AbortController | null>(null);
  const docRef = useRef<ScreenDoc | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const settings = useMemo(() => ({ platform, scale, level }), [platform, scale, level]);
  const items = useMemo(() => evaluate(raw, settings), [raw, settings]);

  /* ---------- Loading ---------- */
  const adopt = useCallback((next: ScreenDoc, sample: boolean, currentPlatform: Platform) => {
    ctl.current?.abort();
    disposeDoc(docRef.current);
    docRef.current = next;
    setDoc(next);
    setIsSample(sample);
    setMeasures([]);
    setHotId(null);
    setCrit(sample ? SAMPLE_CRITIQUE : null);
    setCritState("idle");
    setCritErr("");
    setScale(initialScale(next, currentPlatform));
    if (next.kind === "svg") {
      try {
        setRaw(analyseSvg(next));
        setA11yState("done");
      } catch (e) {
        setRaw(null);
        setA11yState("error");
        setA11yErr("The layers couldn't be measured: " + (e instanceof Error ? e.message : "unknown error"));
      }
    } else {
      setRaw(null);
      setA11yState("idle");
    }
  }, []);

  const loadSample = useCallback(async () => {
    try {
      adopt(await loadSvgDoc(SAMPLE_SVG, SAMPLE_NAME), true, platform);
    } catch (e) {
      setA11yState("error");
      setA11yErr(e instanceof Error ? e.message : "The sample couldn't be loaded.");
    }
  }, [adopt, platform]);

  const openFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      try {
        adopt(await loadFile(file), false, platform);
        toast("Loaded " + (file.name || "screen"));
      } catch (e) {
        toast(e instanceof Error ? e.message : "That file couldn't be opened.");
      }
    },
    [adopt, platform, toast],
  );

  // First paint: restore preferences, load the sample, ask the server whether free runs exist.
  useEffect(() => {
    const p = store.get<Platform>("platform", "ios");
    setPlatformRaw(p);
    setLevelRaw(store.get<Level>("level", "AA"));
    setToneRaw(store.get<Tone>("tone", "mentor"));
    setThumbs(store.get<Record<string, Thumb>>("thumbs", {}));
    setApiKey(store.get<string | null>("apiKey", null));
    loadSvgDoc(SAMPLE_SVG, SAMPLE_NAME).then((d) => adopt(d, true, p)).catch((e) => {
      setA11yState("error");
      setA11yErr(e instanceof Error ? e.message : "The sample couldn't be loaded.");
    });
    fetch("/api/status").then((r) => r.json()).then((s: { hosted: boolean }) => setHosted(!!s.hosted)).catch(() => setHosted(false));
    return () => {
      ctl.current?.abort();
      disposeDoc(docRef.current);
    };
  }, [adopt]);

  /* ---------- Settings ---------- */
  const setPlatform = useCallback((p: Platform) => {
    setPlatformRaw(p);
    store.set("platform", p);
    if (docRef.current?.kind === "raster") setScale(DEFAULT_SCALE[p]);
  }, []);
  const setLevel = useCallback((l: Level) => { setLevelRaw(l); store.set("level", l); }, []);
  const setTone = useCallback((t: Tone) => { setToneRaw(t); store.set("tone", t); }, []);

  const saveKey = useCallback((key: string | null, remember: boolean) => {
    setApiKey(key);
    store.set("apiKey", key && remember ? key : null);
  }, []);

  /* ---------- Claude jobs ---------- */
  const fail = useCallback((job: Job, e: unknown) => {
    const cancelled = e instanceof ClaudeError && e.code === "cancelled";
    const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
    if (job === "a11y") { setA11yState(cancelled ? "idle" : "error"); setA11yErr(msg); }
    else { setCritState(cancelled ? "idle" : "error"); setCritErr(msg); }
    if (needsOwnKey(e)) setKeyPrompt({ reason: msg, then: job });
  }, []);

  const runImageChecks = useCallback(async (keyOverride?: string | null) => {
    const d = docRef.current;
    if (!d || d.kind !== "raster") return;
    ctl.current?.abort();
    const c = (ctl.current = new AbortController());
    setA11yState("running");
    try {
      const image = await docImageForClaude(d);
      const res = await requestLocate({ image, width: d.W, height: d.H, platform, context }, keyOverride ?? apiKey, c.signal);
      if (c !== ctl.current || d !== docRef.current) return;
      setRaw(findingsFromLocate(d, res));
      setA11yState("done");
    } catch (e) {
      if (c === ctl.current) fail("a11y", e);
    }
  }, [apiKey, context, fail, platform]);

  const runCritique = useCallback(async (keyOverride?: string | null) => {
    const d = docRef.current;
    if (!d) return;
    ctl.current?.abort();
    const c = (ctl.current = new AbortController());
    setCritState("running");
    setCritErr("");
    const measured = items
      .filter((i) => i.group === "fail")
      .slice(0, 12)
      .map((i) => `${i.check}: ${i.element} measured ${i.measured}, needs ${i.required}`);
    try {
      const image = await docImageForClaude(d);
      const res = await requestCritique({ image, width: d.W, height: d.H, platform, context, tone, tokens: tokens.slice(0, 4000), measured }, keyOverride ?? apiKey, c.signal);
      if (c !== ctl.current || d !== docRef.current) return;
      const k = normaliseCritique(res, tone);
      if (!k) throw new ClaudeError("invalid_json", "Claude's answer couldn't be read. Try again.");
      setCrit(k);
      setCritState("idle");
    } catch (e) {
      if (c === ctl.current) fail("crit", e);
    }
  }, [apiKey, context, fail, items, platform, tokens, tone]);

  const stop = useCallback(() => ctl.current?.abort(), []);

  /** After a key is added from the prompt, carry on with whatever needed it. */
  const submitKey = useCallback((key: string, remember: boolean) => {
    saveKey(key, remember);
    const then = keyPrompt?.then;
    setKeyPrompt(null);
    if (then === "a11y") runImageChecks(key);
    if (then === "crit") runCritique(key);
  }, [keyPrompt, runCritique, runImageChecks, saveKey]);

  /* ---------- Measure ---------- */
  const addMeasure = useCallback((box: Box) => {
    const d = docRef.current;
    if (!d) return;
    const m = analysePixels(d, box);
    if (!m) return toast("That box is too small to measure.");
    setMeasures((ms) => [...ms, { id: "m" + Date.now(), box, ratio: m.ratio, fg: m.fg, bg: m.bg }]);
  }, [toast]);
  const removeMeasure = useCallback((id: string) => setMeasures((ms) => ms.filter((m) => m.id !== id)), []);

  const setThumb = useCallback((key: string, v: Thumb) => {
    setThumbs((t) => {
      const next = { ...t };
      if (next[key] === v) delete next[key];
      else next[key] = v;
      store.set("thumbs", next);
      return next;
    });
  }, []);

  /* ---------- Exports ---------- */
  const exportAs = useCallback(async (kind: "md" | "pdf" | "png") => {
    const d = docRef.current;
    if (!d) return;
    const base = "second-look-" + fileSlug(d.name);
    const input = { doc: d, settings, raw, items, crit };
    try {
      if (kind === "md") downloadBlob(new Blob([reportMarkdown(input)], { type: "text/markdown" }), base + ".md");
      if (kind === "pdf") downloadBlob(await reportPdf(input), base + ".pdf");
      if (kind === "png") {
        const critMode = mode === "crit" && !!crit;
        const c = overlayCanvas(d, critMode ? "crit" : "a11y", items, crit, 2000);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
        if (blob) downloadBlob(blob, base + (critMode ? "-critique" : "-overlay") + ".png");
      }
    } catch {
      toast("That file couldn't be saved.");
    }
  }, [crit, items, mode, raw, settings, toast]);

  return {
    doc, isSample, raw, items, a11yState, a11yErr, crit, critState, critErr,
    platform, setPlatform, scale, setScale, level, setLevel, context, setContext, tone, setTone, tokens, setTokens,
    mode, setMode, showPasses, setShowPasses, measuring, setMeasuring, measures, addMeasure, removeMeasure,
    thumbs, setThumb, hotId, setHotId,
    apiKey, hosted, saveKey, keyPrompt, setKeyPrompt, submitKey,
    loadSample, openFile, runImageChecks, runCritique, stop, exportAs, toast, toastMsg,
  };
}

export type SecondLook = ReturnType<typeof useSecondLook>;
