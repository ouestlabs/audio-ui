"use client";

import { $htmlAudio } from "@/registry-audio/bases/base/lib/html-audio";

/**
 * Access the HTML Audio playback engine — track playback, streaming.
 *
 * @example
 * ```tsx
 * const htmlAudio = useHtmlAudio();
 * await htmlAudio.load({ url: track.url });
 * htmlAudio.play();
 * ```
 */
export function useHtmlAudio() {
  return $htmlAudio;
}
