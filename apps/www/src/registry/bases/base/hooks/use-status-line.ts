import { useEffect, useState } from "react";

/** How long a message stays, in milliseconds. */
const DEFAULT_MS = 5000;

/**
 * A line of status an editor says things on: what it is doing ("Rendering…")
 * and what an action had nothing to do on. A message clears itself after
 * `ms`; saying something else, or nothing, replaces it.
 */
export function useStatusLine(ms = DEFAULT_MS) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!status) {
      return;
    }
    const timer = window.setTimeout(() => setStatus(""), ms);
    return () => window.clearTimeout(timer);
  }, [ms, status]);
  return [status, setStatus] as const;
}
