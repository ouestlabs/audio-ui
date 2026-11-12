import { useSyncExternalStore } from "react";

let expanded = false;
const listeners = new Set<() => void>();

/** Whether the home's audio editor fills the inset, the title and the page under it out of its way. */
export function setEditorExpanded(next: boolean) {
  if (next === expanded) {
    return;
  }
  expanded = next;
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

const read = () => expanded;
const onServer = () => false;

/** Whether the home's audio editor fills the inset: the bar's button and the home read the same value. */
export function useEditorExpanded() {
  return useSyncExternalStore(subscribe, read, onServer);
}
