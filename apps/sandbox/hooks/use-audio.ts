"use client";

import { $htmlAudio } from "@/lib/html-audio";
import { $webAudio } from "@/lib/web-audio";

/**
 * Unified React hook to access both HTML Audio and Web Audio API instances
 * - htmlAudio: For HTML5 audio playback (tracks, streaming)
 * - webAudio: For Web Audio API (synthesis, effects, sound effects)
 *
 * @returns An object with both audio instances
 *
 * @example
 * ```tsx
 * const { htmlAudio, webAudio } = useAudio();
 *
 * // Use HTML Audio for playback
 * await htmlAudio.load({ url: track.url });
 * htmlAudio.play();
 *
 * // Use Web Audio for synthesis
 * const ctx = webAudio.getContext();
 * const oscillator = ctx.createOscillator();
 * ```
 */
export function useAudio() {
  return {
    htmlAudio: $htmlAudio,
    webAudio: $webAudio,
  };
}
