"use client";

import {
  type EqBand,
  toWebAudioQ,
  WEB_AUDIO_FILTER_TYPES,
} from "@audio-ui/engine/analysis";
import { noiseBuffer } from "@audio-ui/engine/device";
import { useEffect, useRef, useState } from "react";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** The noise's level out: audio.js's pink noise peaks at 0.9, so this keeps it where the demo always played it. */
const OUTPUT_GAIN = 0.09;
const ANALYSER_SMOOTHING = 0.8;
const FFT_SIZE = 4096;
const PARAM_RAMP_SECONDS = 0.02;

/** Puts a band on its filter: outright on a fresh one (`at` null), which starts at Web Audio's defaults, by a ramp from `at` on one that plays. */
function tune(filter: BiquadFilterNode, band: EqBand, at: number | null) {
  const set = (param: AudioParam, value: number) => {
    if (at === null) {
      param.value = value;
    } else {
      param.setTargetAtTime(value, at, PARAM_RAMP_SECONDS);
    }
  };
  set(filter.frequency, band.frequency);
  set(filter.gain, band.gainDb ?? 0);
  set(filter.Q, toWebAudioQ(band.type, band.q));
}

/**
 * Pink noise played through an equalizer that follows `bands`, so what a plot
 * draws is what is heard. Returns the analyser after the filters, for
 * `useSpectrum`. It plays while the page's play switch is on (`usePlaySwitch`),
 * and stops when it goes off or when the component unmounts.
 */
export function useNoiseThroughEq(bands: readonly EqBand[]) {
  const { playing } = usePlaySwitch();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const bandsRef = useRef(bands);
  bandsRef.current = bands;
  // The chain is rebuilt when a band comes or goes, or changes type.
  const bandTypes = bands.map((band) => band.type).join();

  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilds the chain when the band types change.
  useEffect(() => {
    if (!playing) {
      return;
    }
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    webAudio.resume();
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, "pink");
    source.loop = true;
    const filters = bandsRef.current.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = WEB_AUDIO_FILTER_TYPES[band.type];
      tune(filter, band, null);
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
      if (filter) {
        tune(filter, band, ctx.currentTime);
      }
    });
  }, [bands]);

  return { analyser };
}
