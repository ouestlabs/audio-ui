"use client";

import { useEffect, useState } from "react";
import {
  type SpectrumBandsOptions,
  spectrumBands,
} from "@/registry-audio/bases/base/lib/waveform-dsp";

/**
 * A live signal of levels, 0-1 each, in the shape of an external store. Pass
 * it to a LiveWaveform or a BarVisualizer's `source`. The snapshot is one
 * array, updated in place.
 */
export interface AudioSignalSource {
  getSnapshot: () => Float32Array;
  subscribe: (listener: () => void) => () => void;
}

export interface AudioSignal {
  /** Frequency bands, low to high: for bars that dance to the sound. */
  bands: AudioSignalSource;
  /** The loudest sample of the moment, as a single level: for a waveform that scrolls. */
  level: AudioSignalSource;
}

export interface UseAudioSignalOptions
  extends Pick<SpectrumBandsOptions, "maxHz" | "minHz"> {
  /** How many frequency bands `bands` carries. @default 32 */
  bandCount?: number;
}

function createSignalStore() {
  let levels: Float32Array = new Float32Array(0);
  const listeners = new Set<() => void>();
  const source: AudioSignalSource = {
    getSnapshot: () => levels,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    isWatched: () => listeners.size > 0,
    publish: (next: Float32Array) => {
      levels = next;
      for (const listener of listeners) {
        listener();
      }
    },
    source,
  };
}

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  return Math.min(1, peak);
}

/**
 * Reads an AnalyserNode every animation frame (paused automatically while the
 * tab is in the background) into two live signals: `level`, the loudest sample
 * of the moment, and `bands`, the spectrum as log-spaced frequency bands. Each
 * is only computed while something is subscribed to it.
 *
 * Returns stable sources rather than React state, so sampling never re-renders
 * the component that calls it. Without an analyser both signals fall silent
 * and stop: a scrolling waveform holds still, bars come to rest.
 */
export function useAudioSignal(
  analyser: AnalyserNode | null,
  { bandCount = 32, maxHz, minHz }: UseAudioSignalOptions = {}
): AudioSignal {
  const [stores] = useState(() => ({
    bands: createSignalStore(),
    level: createSignalStore(),
  }));
  const [signal] = useState<AudioSignal>(() => ({
    bands: stores.bands.source,
    level: stores.level.source,
  }));

  useEffect(() => {
    const bands = new Float32Array(bandCount);
    const level = new Float32Array(1);
    stores.bands.publish(bands);
    stores.level.publish(level);
    if (!analyser) {
      return;
    }

    const samples = new Float32Array(analyser.fftSize);
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    const bandsOptions = {
      maxDb: analyser.maxDecibels,
      maxHz,
      minDb: analyser.minDecibels,
      minHz,
      sampleRate: analyser.context.sampleRate,
    };
    let frameId: number;

    const tick = () => {
      if (stores.level.isWatched()) {
        analyser.getFloatTimeDomainData(samples);
        level[0] = peakOf(samples);
        stores.level.publish(level);
      }
      if (stores.bands.isWatched()) {
        analyser.getFloatFrequencyData(spectrum);
        stores.bands.publish(spectrumBands(spectrum, bands, bandsOptions));
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [analyser, bandCount, maxHz, minHz, stores]);

  return signal;
}
