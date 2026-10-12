import * as React from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * Matches the `lg` breakpoint that switches the customizer between the
 * desktop `CustomizerSidebar` aside and the `CustomizerSidebarMobileSheet`.
 * Shared so the two surfaces are always mutually exclusive.
 */
export function useIsDesktopCustomizer() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  );
}

const MEDIUM_QUERY = "(min-width: 768px)";

function subscribeMedium(callback: () => void) {
  const mql = window.matchMedia(MEDIUM_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** Matches the `md` breakpoint, from which the floating customizer is a tall column of choices rather than a short strip. */
export function useIsMediumScreen() {
  return React.useSyncExternalStore(
    subscribeMedium,
    () => window.matchMedia(MEDIUM_QUERY).matches,
    () => true
  );
}
