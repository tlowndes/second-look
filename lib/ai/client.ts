import type { ApiError, CritiqueRequest, CritiqueResult, LocateRequest, LocateResult } from "./schemas";

/* Browser side of the two API routes. */

export const USER_KEY_HEADER = "x-user-anthropic-key";

export class ClaudeError extends Error {
  constructor(public code: ApiError["error"]["code"] | "cancelled" | "network", message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, apiKey: string | null, signal: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { [USER_KEY_HEADER]: apiKey } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal.aborted) throw new ClaudeError("cancelled", "Stopped.");
    throw new ClaudeError("network", "Claude couldn't be reached. Check your connection and try again.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (json as ApiError | null)?.error;
    throw new ClaudeError(err?.code ?? "upstream", err?.message ?? "Something went wrong. Try again.");
  }
  return json as T;
}

export const requestLocate = (body: LocateRequest, apiKey: string | null, signal: AbortSignal) =>
  post<LocateResult>("/api/locate", body, apiKey, signal);

export const requestCritique = (body: CritiqueRequest, apiKey: string | null, signal: AbortSignal) =>
  post<CritiqueResult>("/api/critique", body, apiKey, signal);

/** Errors that a visitor's own key would fix. */
export const needsOwnKey = (e: unknown) =>
  e instanceof ClaudeError && (e.code === "no_key" || e.code === "daily_limit" || e.code === "visitor_limit" || e.code === "invalid_key");
