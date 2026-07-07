"use client";

import type * as React from "react";
import {
  AudioProvider,
  demoTracks,
} from "@/registry-audio/bases/base/audio/player";

/**
 * Seeds the shared audio store with demo tracks and wires the HTML audio
 * element so live audio previews (player, queue, track, playback-speed) work
 * out of the box. The registry demo files stay clean — the ambient store is
 * provided by the preview surface, not baked into each snippet.
 */
export function AudioDemoProvider({ children }: { children: React.ReactNode }) {
  return <AudioProvider tracks={demoTracks}>{children}</AudioProvider>;
}

const AUDIO_STORE_CATEGORIES = new Set([
  "player",
  "queue",
  "track",
  "playback-speed",
]);

/** Whether a catalog contains any demo that reads from the audio store. */
export function catalogNeedsAudioProvider(
  items: { categories: string[] }[]
): boolean {
  return items.some((item) =>
    item.categories.some((category) => AUDIO_STORE_CATEGORIES.has(category))
  );
}
