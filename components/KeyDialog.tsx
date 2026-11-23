"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lets a visitor use their own Anthropic API key. The key goes to this app's server with each
 * request and on to Anthropic. It is never stored server-side; "remember" keeps it in this browser only.
 */
export function KeyDialog({
  open, reason, hasKey, onSubmit, onForget, onClose,
}: {
  open: boolean;
  reason: string | null;
  hasKey: boolean;
  onSubmit: (key: string, remember: boolean) => void;
  onForget: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); setErr(""); }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="keydlg" aria-labelledby="keyTitle" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          const k = key.trim();
          if (!/^sk-ant-[\w-]{20,}$/.test(k)) return setErr("That doesn't look like an Anthropic API key. It starts with sk-ant-.");
          onSubmit(k, remember);
          setKey("");
        }}
      >
        <h2 id="keyTitle">Use your own API key</h2>
        {reason && <p>{reason}</p>}
        <p>
          Runs then bill to your Anthropic account. Get a key from the{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">Anthropic Console</a>.
        </p>
        <label className="lbl" htmlFor="apiKey">Anthropic API key</label>
        <input id="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
        {err && <p style={{ color: "var(--fail)" }}>{err}</p>}
        <label className="chk">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember on this device
        </label>
        <p className="hint">Sent with each run through this app&apos;s server to Anthropic. Never stored or logged on the server.</p>
        <div className="row">
          {hasKey && <button className="btn" type="button" onClick={onForget}>Forget my key</button>}
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="submit">Save key</button>
        </div>
      </form>
    </dialog>
  );
}
