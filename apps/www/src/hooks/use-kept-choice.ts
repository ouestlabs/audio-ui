import { useQueryState } from "nuqs";
import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * A choice of the reader kept in their browser and in the address (`?name=`),
 * a link's value winning over the one kept: what the framework and the styling
 * of the docs are. Null until chosen, and on the server, where the pages are
 * prerendered for any choice.
 */
export function createKeptChoice<T extends string>({
  isValid,
  key,
  param,
}: {
  isValid: (value: unknown) => value is T;
  /** Where the browser keeps it. */
  key: string;
  /** The address' parameter. */
  param: string;
}) {
  const listeners = new Set<() => void>();
  /** The choice, once read: kept here when storage is out of reach (a private window). */
  let chosen: T | null | undefined;

  function read(): T | null {
    if (chosen === undefined) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(key);
      } catch {
        // Storage is out of reach: nothing was kept.
      }
      chosen = isValid(stored) ? stored : null;
    }
    return chosen;
  }

  /** Keeps a choice in the browser and tells every reader of it, the address left as it is: a choice that goes to another page carries it in that page's link. */
  function remember(next: T | null) {
    chosen = next;
    try {
      if (next) {
        localStorage.setItem(key, next);
      } else {
        localStorage.removeItem(key);
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

  /** The choice, as the reader made it in the sidebar, a tab or the customizer, and the way to choose. */
  function useChoice() {
    const [value, setValue] = useQueryState(param);
    const kept = useSyncExternalStore(subscribe, read, () => null);
    // A link that names a choice makes it, for the pages that come next.
    useEffect(() => {
      if (isValid(value) && value !== read()) {
        remember(value);
      }
    }, [value]);
    const choose = useCallback(
      (next: T | null) => {
        remember(next);
        setValue(next);
      },
      [setValue]
    );
    return [isValid(value) ? value : kept, choose] as const;
  }

  return { remember, useChoice };
}
