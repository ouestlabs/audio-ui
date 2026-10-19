import { useCallback, useSyncExternalStore } from "react";

const CHANGE = "lab:persisted-state";
/** What was set this session, so a browser without storage still keeps the choice until the page is left. */
const memory = new Map<string, boolean>();

function read(key: string, fallback: boolean) {
  const kept = memory.get(key);
  if (kept !== undefined) {
    return kept;
  }
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  // Another tab of the lab sets it: this one follows.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * A boolean the browser remembers between visits. The page is built ahead of
 * time, so it is the fallback on the server and while the page hydrates, and
 * the stored choice right after, with no mismatch to report.
 */
export function usePersistedState(key: string, fallback: boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback
  );
  const set = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const resolved =
        typeof next === "function" ? next(read(key, fallback)) : next;
      memory.set(key, resolved);
      try {
        window.localStorage.setItem(key, String(resolved));
      } catch {
        // Storage can be blocked: the choice then lasts as long as the page.
      }
      window.dispatchEvent(new Event(CHANGE));
    },
    [key, fallback]
  );
  return [value, set] as const;
}
