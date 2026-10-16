"use client";

import {
  type EqBand,
  toWebAudioQ,
  WEB_AUDIO_FILTER_TYPES,
} from "@audio-ui/core/analysis";
import { useCallback, useEffect, useRef, useState } from "react";
import { pinkNoise } from "@/registry-audio/bases/base/lib/pink-noise";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const OUTPUT_GAIN = 0.12;
const ANALYSER_SMOOTHING = 0.8;
const FFT_SIZE = 4096;
const PARAM_RAMP_SECONDS = 0.02;

/**
 * Pink noise played through an equalizer that follows `bands`, so what a plot
 * draws is what is heard. Returns the analyser after the filters, for
 * `useSpectrum`, and whether it is playing. Stops when the component unmounts.
 */
export function useNoiseThroughEq(bands: readonly EqBand[]) {
  const [playing, setPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const bandsRef = useRef(bands);
  bandsRef.current = bands;
  // The chain is rebuilt when a band comes or goes, or changes type.
  const bandTypes = bands.map((band) => band.type).join();

  const toggle = useCallback(() => setPlaying((on) => !on), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilds the chain when the band types change.
  useEffect(() => {
    if (!playing) {
      return;
    }
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = pinkNoise(ctx);
    source.loop = true;
    const filters = bandsRef.current.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = WEB_AUDIO_FILTER_TYPES[band.type];
      return filter;
    });
    const tap = ctx.createAnalyser();
    tap.fftSize = FFT_SIZE;
    tap.smoothingTimeConstant = ANALYSER_SMOOTHING;
    const output = ctx.createGain();
    output.gain.value = OUTPUT_GAIN;
    const nodes = [source, ...filters, tap, output];
    nodes.reduce((from, to) => {
      from.connect(to);
      return to;
    });
    output.connect(ctx.destination);
    filtersRef.current = filters;
    source.start();
    setAnalyser(tap);
    return () => {
      source.stop();
      for (const node of nodes) {
        node.disconnect();
      }
      filtersRef.current = [];
      setAnalyser(null);
    };
  }, [bandTypes, playing, webAudio]);

  // The bands move the filters while the noise plays.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    bands.forEach((band, index) => {
      const filter = filtersRef.current[index];
      if (!filter) {
        return;
      }
      const now = ctx.currentTime;
      filter.frequency.setTargetAtTime(band.frequency, now, PARAM_RAMP_SECONDS);
      filter.gain.setTargetAtTime(band.gainDb ?? 0, now, PARAM_RAMP_SECONDS);
      filter.Q.setTargetAtTime(
        toWebAudioQ(band.type, band.q),
        now,
        PARAM_RAMP_SECONDS
      );
    });
  }, [bands]);

  return { analyser, playing, toggle };
}
