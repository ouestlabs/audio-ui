"use client";

import { createSource, type Source } from "@audio-ui/react";
import { useEffect, useState } from "react";
import {
  type LogSpectrumOptions,
  logSpectrum,
  SPECTRUM_FLOOR_DB,
} from "@/registry-audio/bases/base/lib/spectrum";

export interface UseSpectrumOptions extends LogSpectrumOptions {
  /** How many points the spectrum has, spread along a log frequency axis. @default 160 */
  points?: number;
}

/**
 * The spectrum of an `AnalyserNode` as a live source for a plot's
 * `Plot.Trace`: dB per point along a logarithmic frequency axis, refreshed
 * every frame while the analyser is there, with no React render per frame.
 * The snapshot is one array, updated in place.
 */
export function useSpectrum(
  analyser: AnalyserNode | null,
  { maxHz, minHz, points = 160 }: UseSpectrumOptions = {}
): Source<Float32Array> {
  const [source] = useState(() =>
    createSource<Float32Array>(new Float32Array(points).fill(SPECTRUM_FLOOR_DB))
  );

  useEffect(() => {
    if (!analyser) {
      return;
    }
    const bins = new Float32Array(
      new ArrayBuffer(analyser.frequencyBinCount * 4)
    );
    const values = new Float32Array(points);
    let frame = 0;
    const tick = () => {
      analyser.getFloatFrequencyData(bins);
      source.set(
        logSpectrum(bins, analyser.context.sampleRate, values, {
          maxHz,
          minHz,
        })
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source.set(new Float32Array(points).fill(SPECTRUM_FLOOR_DB));
    };
  }, [analyser, maxHz, minHz, points, source]);

  return source;
}
