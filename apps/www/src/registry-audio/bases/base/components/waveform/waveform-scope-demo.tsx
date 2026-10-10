"use client";

import { createSource } from "@audio-ui/react";
import { useEffect, useState } from "react";
import { LiveWaveform } from "@/registry-audio/bases/base/audio/elements/waveform";

const SAMPLE_COUNT = 512;

/** A stand-in for an oscillator, in the shape `useAudioSignal(analyser).samples` has: two detuned sines beating against each other, so the demo moves without any audio. */
function useBeatingSamples() {
  const [source] = useState(() => createSource(new Float32Array(SAMPLE_COUNT)));

  useEffect(() => {
    const samples = source.getSnapshot();
    let frameId: number;

    const tick = (now: number) => {
      const seconds = now / 1000;
      for (let index = 0; index < SAMPLE_COUNT; index += 1) {
        const phase = (index / SAMPLE_COUNT) * Math.PI * 2;
        samples[index] =
          0.5 * Math.sin(phase * 3 + seconds * 2) +
          0.35 * Math.sin(phase * 7.5 - seconds * 3.1);
      }
      source.set(samples);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [source]);

  return source;
}

export default function WaveformScopeDemo() {
  const samples = useBeatingSamples();
  return (
    <LiveWaveform
      aria-label="Oscillator output"
      shape="scope"
      source={samples}
    />
  );
}
