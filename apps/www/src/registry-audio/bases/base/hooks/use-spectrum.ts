"use client";

import {
  holdPeaks,
  type LogSpectrumOptions,
  logSpectrum,
  type PeakHoldOptions,
  SPECTRUM_FLOOR_DB,
} from "@audio-ui/core/analysis";
import { createSource, type Source } from "@audio-ui/react";
import { useEffect, useState } from "react";

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

/**
 * The peaks of a spectrum `source`, as a live source of their own: each point
 * keeps the loudest level it reached for `hold` seconds, then falls at `fall`
 * dB per second. Drawn as a second `Plot.Trace` over the spectrum, with no
 * React render per frame.
 */
export function useSpectrumPeaks(
  source: Source<Float32Array>,
  { fall, hold }: PeakHoldOptions = {}
): Source<Float32Array> {
  const [peaks] = useState(() =>
    createSource<Float32Array>(
      new Float32Array(source.getSnapshot().length).fill(SPECTRUM_FLOOR_DB)
    )
  );

  useEffect(() => {
    let values = peaks.getSnapshot();
    let holding = new Float32Array(values.length);
    let followed = source.getSnapshot();
    let last = performance.now();
    return source.subscribe(() => {
      const spectrum = source.getSnapshot();
      // A spectrum source keeps one array while it runs: a new one means it restarted or went quiet.
      if (spectrum !== followed) {
        followed = spectrum;
        values = new Float32Array(spectrum.length).fill(SPECTRUM_FLOOR_DB);
        holding = new Float32Array(spectrum.length);
      }
      const now = performance.now();
      peaks.set(
        holdPeaks(spectrum, values, holding, (now - last) / 1000, {
          fall,
          hold,
        })
      );
      last = now;
    });
  }, [fall, hold, peaks, source]);

  return peaks;
}
