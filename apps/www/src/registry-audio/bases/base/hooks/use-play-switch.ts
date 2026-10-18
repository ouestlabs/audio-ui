"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let playing = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setPlaying(next: boolean) {
  if (next === playing) {
    return;
  }
  playing = next;
  for (const listener of listeners) {
    listener();
  }
}

const getSnapshot = () => playing;
const getServerSnapshot = () => false;
const toggle = () => setPlaying(!playing);

/**
 * The page's one play switch: a button anywhere on the page flips it, and
 * every component that reads it follows. It holds no audio, only whether the
 * sound should be on, so a demo can leave its play button to the page.
 */
export function usePlaySwitch() {
  const isPlaying = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return { playing: isPlaying, setPlaying, toggle };
}
