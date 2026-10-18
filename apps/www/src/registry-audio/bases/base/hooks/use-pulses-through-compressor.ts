"use client";

import { createSource, type Source } from "@audio-ui/react";
import { useEffect, useRef, useState } from "react";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const LOOP_SECONDS = 2;
const PULSES_PER_LOOP = 8;
const PULSE_DECAY_SECONDS = 0.18;
const OUTPUT_GAIN = 0.4;
const FLOOR_DB = -80;
const FFT_SIZE = 1024;
const PARAM_RAMP_SECONDS = 0.02;
/** How fast the level falls back between pulses, in dB per frame. */
const LEVEL_FALL_DB = 1.2;

export interface CompressorControls {
  kneeDb?: number;
  ratio: number;
  thresholdDb: number;
}

/** Noise bursts that start loud and fade, eight to a loop, the loudest reaching about 0 dB. */
function pulses(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * LOOP_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  const pulseLength = data.length / PULSES_PER_LOOP;
  for (let index = 0; index < data.length; index += 1) {
    const seconds = (index % pulseLength) / ctx.sampleRate;
    // Every other pulse is quieter, so the level moves along the curve.
    const accent = Math.floor(index / pulseLength) % 2 === 0 ? 1 : 0.35;
    data[index] =
      (Math.random() * 2 - 1) *
      accent *
      Math.exp(-seconds / PULSE_DECAY_SECONDS);
  }
  return buffer;
}

/**
 * A looping pulse played through a compressor that follows `controls`, with
 * the level going in as a live source in dB, falling back between pulses.
 * Pair it with a transfer curve's `Plot.Dot`: the dot rides the curve as the
 * level moves. It plays while the page's play switch is on (`usePlaySwitch`),
 * and stops when it goes off or when the component unmounts.
 */
export function usePulsesThroughCompressor(controls: CompressorControls) {
  const { playing } = usePlaySwitch();
  const [level] = useState(() => createSource(FLOOR_DB));
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

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
    source.buffer = pulses(ctx);
    source.loop = true;
    const tap = ctx.createAnalyser();
    tap.fftSize = FFT_SIZE;
    const compressor = ctx.createDynamicsCompressor();
    // The node starts at its own defaults (12:1, a 30 dB knee): set it to the
    // controls now, or it plays something else until a control moves.
    const { kneeDb = 0, ratio, thresholdDb } = controlsRef.current;
    compressor.threshold.value = thresholdDb;
    compressor.ratio.value = ratio;
    compressor.knee.value = kneeDb;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    const output = ctx.createGain();
    output.gain.value = OUTPUT_GAIN;
    source.connect(tap);
    tap.connect(compressor);
    compressor.connect(output);
    output.connect(ctx.destination);
    compressorRef.current = compressor;
    source.start();

    const samples = new Float32Array(new ArrayBuffer(tap.fftSize * 4));
    let held = FLOOR_DB;
    let frame = 0;
    const tick = () => {
      tap.getFloatTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
      }
      const db =
        peak > 0 ? Math.max(FLOOR_DB, 20 * Math.log10(peak)) : FLOOR_DB;
      held = Math.max(db, held - LEVEL_FALL_DB);
      level.set(held);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source.stop();
      for (const node of [source, tap, compressor, output]) {
        node.disconnect();
      }
      compressorRef.current = null;
      level.set(FLOOR_DB);
    };
  }, [level, playing]);

  // The controls move the compressor while it plays.
  useEffect(() => {
    const ctx = webAudio.getContext();
    const compressor = compressorRef.current;
    if (!(ctx && compressor)) {
      return;
    }
    const now = ctx.currentTime;
    compressor.threshold.setTargetAtTime(
      controls.thresholdDb,
      now,
      PARAM_RAMP_SECONDS
    );
    compressor.ratio.setTargetAtTime(controls.ratio, now, PARAM_RAMP_SECONDS);
    compressor.knee.setTargetAtTime(
      controls.kneeDb ?? 0,
      now,
      PARAM_RAMP_SECONDS
    );
  }, [controls]);

  return { level: level as Source<number> };
}
