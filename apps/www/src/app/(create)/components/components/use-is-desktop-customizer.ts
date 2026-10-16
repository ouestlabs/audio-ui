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
