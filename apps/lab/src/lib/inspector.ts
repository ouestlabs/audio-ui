import { useEffect, useSyncExternalStore } from "react";

/**
 * What a device lets the lab see of it: where its sound comes out, and the
 * patch it is playing. The device publishes it, the details panel reads it.
 * It lives outside React state, so a knob dragged at frame rate re-renders the
 * panel and nothing else.
 */
export interface InspectorData {
  /** The node the device's sound leaves by, before it reaches the speakers. */
  output: AudioNode | null;
  /** What the device is playing, as a name and a value per control. */
  patch: Record<string, number | string> | null;
}

const EMPTY: InspectorData = { output: null, patch: null };

let current = EMPTY;
const listeners = new Set<() => void>();

function publish(data: InspectorData) {
  current = data;
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

/** For the panel: what the device on screen published, nothing when it published nothing. */
export function useInspector() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY
  );
}

/** For a device: show this to the lab while it is on screen, and take it back when it leaves. */
export function usePublishInspector({ output, patch }: InspectorData) {
  useEffect(() => {
    publish({ output, patch });
  }, [output, patch]);
  useEffect(() => () => publish(EMPTY), []);
}
