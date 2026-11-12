import { useQueryState } from "nuqs";
import * as React from "react";
import { type FrameworkId, isFramework } from "@/lib/docs/content/frameworks";

const STORAGE_KEY = "audio-ui-framework";
const listeners = new Set<() => void>();

/** The framework chosen, once read: kept here when storage is out of reach (a private window). */
let chosen: FrameworkId | null | undefined;

function read(): FrameworkId | null {
  if (chosen === undefined) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage is out of reach: nothing was kept.
    }
    chosen = isFramework(stored) ? stored : null;
  }
  return chosen;
}

/** Keeps a choice in the browser and tells every reader of it, the address left as it is: a choice that goes to another page carries it in that page's link. */
export function rememberFramework(next: FrameworkId | null) {
  chosen = next;
  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, next);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage is out of reach: the choice lasts until the page reloads.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The framework the reader uses, as they chose it in the sidebar or a
 * framework's tab, and the way to choose: kept in their browser, and in the
 * address as `?framework=` so a link carries it, a link's winning over the
 * one kept. Null until they choose, and on the server: the pages are
 * prerendered for any framework.
 */
export function useFramework() {
  const [param, setParam] = useQueryState("framework");
  const kept = React.useSyncExternalStore(subscribe, read, () => null);
  // A link that names a framework chooses it, for the pages that come next.
  React.useEffect(() => {
    if (isFramework(param) && param !== read()) {
      rememberFramework(param);
    }
  }, [param]);
  const choose = React.useCallback(
    (next: FrameworkId | null) => {
      rememberFramework(next);
      setParam(next);
    },
    [setParam]
  );
  return [isFramework(param) ? param : kept, choose] as const;
}
