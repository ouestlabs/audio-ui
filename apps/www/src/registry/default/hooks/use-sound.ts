"use client";

import * as React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";

/**
 * Load and play a sound from a given URL using the Web Audio API.
 *
 * This hook fetches the audio file at the specified URL, decodes it, and prepares it for playback.
 * It returns a `play` function that can be called to play the loaded sound.
 * @author Original implementation by [ncdai](https://github.com/ncdai/chanhdai.com/blob/main/src/hooks/use-sound.ts)
 * @param url - The URL of the audio file to load and play.
 * @returns A function that, when called, plays the loaded sound.
 *
 * @example
 * ```tsx
 * const playClick = useSound('/sounds/click.wav');
 * // Later in an event handler:
 * playClick();
 * ```
 */
export function useSound(url: string) {
  const { webAudio } = useAudio();
  const bufferRef = React.useRef<AudioBuffer | null>(null);

  React.useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      console.warn("Web Audio API is not supported in this browser.");
      return;
    }

    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((decoded) => {
        bufferRef.current = decoded;
      })
      .catch((err) => {
        console.log(`Failed to load click sound from ${url}:`, err);
      });
  }, [url, webAudio]);

  const play = React.useCallback(
    (volume = 1) => {
      const ctx = webAudio.getContext();
      if (ctx && bufferRef.current) {
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();

        source.buffer = bufferRef.current;
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
      }
    },
    [webAudio]
  );

  return play;
}
