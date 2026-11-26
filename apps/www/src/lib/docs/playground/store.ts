import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  PLAYGROUNDS,
  type PlaygroundName,
  type Values,
} from "@/lib/docs/playground/playgrounds";

/**
 * What the playgrounds of the page are set to, shared by the preview that
 * shows one and the customizer's Component tab that sets it: they are in two
 * trees of the page. Kept while the reader stays on the site.
 */
const settings = new Map<PlaygroundName, Values>();
/** The playgrounds the page shows, the first one the Component tab sets. */
const shown: PlaygroundName[] = [];
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
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

const snapshot = () => version;

/** A playground's settings, and the way to change one. */
export function usePlayground(name: PlaygroundName) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const values = settings.get(name) ?? PLAYGROUNDS[name].defaults;
  const set = useCallback(
    (control: string, value: string) => {
      settings.set(name, {
        ...(settings.get(name) ?? PLAYGROUNDS[name].defaults),
        [control]: value,
      });
      changed();
    },
    [name]
  );
  return [values, set] as const;
}

/** Tells the Component tab the page shows a playground, while the preview is on the page. */
export function useShownPlayground(name: PlaygroundName | undefined) {
  useEffect(() => {
    if (!name) {
      return;
    }
    shown.push(name);
    changed();
    return () => {
      shown.splice(shown.indexOf(name), 1);
      changed();
    };
  }, [name]);
}

/** The playground the Component tab sets: the page's first. */
export function useActivePlayground(): PlaygroundName | undefined {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return shown[0];
}
