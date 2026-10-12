import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const canMatchMedia = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

function subscribe(onChange: () => void): () => void {
  if (!canMatchMedia()) {
    return () => undefined;
  }
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => canMatchMedia() && window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/** Whether the operating system asks for reduced motion. */
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
