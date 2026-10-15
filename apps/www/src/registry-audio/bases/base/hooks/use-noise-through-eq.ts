"use client";

import {
  type EqBand,
  toWebAudioQ,
  WEB_AUDIO_FILTER_TYPES,
} from "@audio-ui/core/analysis";
import { useCallback, useEffect, useRef, useState } from "react";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const NOISE_SECONDS = 4;
const OUTPUT_GAIN = 0.12;
const ANALYSER_SMOOTHING = 0.8;
const FFT_SIZE = 4096;
const PARAM_RAMP_SECONDS = 0.02;

/** Pink noise: equal energy per octave, so a flat equalizer looks flat. Paul Kellet's filter. */
function pinkNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * NOISE_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.998_86 * b0 + white * 0.055_517_9;
    b1 = 0.993_32 * b1 + white * 0.075_075_9;
    b2 = 0.969 * b2 + white * 0.153_852;
    b3 = 0.8665 * b3 + white * 0.310_485_6;
    b4 = 0.55 * b4 + white * 0.532_952_2;
    b5 = -0.7616 * b5 - white * 0.016_898;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115_926;
  }
  return buffer;
}

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
