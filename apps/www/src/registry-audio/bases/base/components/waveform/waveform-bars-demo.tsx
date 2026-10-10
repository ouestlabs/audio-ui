"use client";

import { createSource } from "@audio-ui/react";
import { useEffect, useState } from "react";
import { BarVisualizer } from "@/registry-audio/bases/base/audio/elements/waveform";

const BAND_COUNT = 16;

/** A stand-in for a voice, in the shape `useAudioSignal(analyser).bands` has: phrases whose energy sits in the low bands and wanders, so the demo moves without any audio. */
function useVoiceLikeBands() {
  const [source] = useState(() => createSource(new Float32Array(BAND_COUNT)));

  useEffect(() => {
    const bands = source.getSnapshot();
    let frameId: number;

    const tick = (now: number) => {
      const seconds = now / 1000;
      const phrase = Math.max(0, Math.sin(seconds * 1.1) + 0.35);
      for (let band = 0; band < BAND_COUNT; band += 1) {
        const tilt = Math.exp(-band / (BAND_COUNT * 0.45));
        const wobble =
          0.5 + 0.5 * Math.sin(seconds * (5 + band * 0.9) + band * 1.7);
        bands[band] = Math.min(1, phrase * tilt * (0.35 + 0.65 * wobble));
      }
      source.set(bands);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [source]);

  return source;
}

export default function WaveformBarsDemo() {
  const bands = useVoiceLikeBands();
  return (
    <div className="@container w-full">
      <div className="grid grid-cols-1 gap-6 @sm:grid-cols-3">
        <figure className="flex min-w-0 flex-col items-center gap-2">
          <BarVisualizer aria-label="Agent speaking" mirrored source={bands} />
          <figcaption className="text-muted-foreground text-xs">
            Speaking
          </figcaption>
        </figure>
        <figure className="flex min-w-0 flex-col items-center gap-2">
          <BarVisualizer aria-label="Agent listening" idle="wave" />
          <figcaption className="text-muted-foreground text-xs">
            Listening
          </figcaption>
        </figure>
        <figure className="flex min-w-0 flex-col items-center gap-2">
          <BarVisualizer aria-label="Agent connecting" loading />
          <figcaption className="text-muted-foreground text-xs">
            Connecting
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
