"use client";

import { createSource } from "@audio-ui/react";
import { useEffect, useState } from "react";
import { LiveWaveform } from "@/registry-audio/bases/base/audio/elements/waveform";

/** A stand-in for a microphone, in the shape `useAudioSignal(analyser).level` has: speech-like bursts, so the demo moves without asking for the mic. */
function useSpeechLikeLevel() {
  const [source] = useState(() => createSource(new Float32Array(1)));

  useEffect(() => {
    const level = source.getSnapshot();
    let frameId: number;

    const tick = (now: number) => {
      const seconds = now / 1000;
      // Phrases a few seconds long, syllables inside them, and some grain.
      const phrase = Math.max(0, Math.sin(seconds * 1.1) + 0.35);
      const syllable = 0.55 + 0.45 * Math.sin(seconds * 9.5);
      const grain = 0.75 + 0.25 * Math.random();
      level[0] = Math.min(1, phrase * syllable * grain * 0.7);
      source.set(level);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [source]);

  return source;
}

export default function WaveformLiveDemo() {
  const level = useSpeechLikeLevel();
  return (
    <LiveWaveform
      aria-label="Microphone input"
      mode="scrolling"
      source={level}
    />
  );
}
