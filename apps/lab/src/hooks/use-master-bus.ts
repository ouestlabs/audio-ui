"use client";

import { useEffect, useRef, useState } from "react";
import { webAudio } from "@/lib/web-audio";

const VOLUME_RAMP_SECONDS = 0.01;

/**
 * The safety limiter every master bus ends in: a compressor with a very high
 * ratio and no knee, since Web Audio has no limiter node. Below the threshold
 * the signal passes unchanged; far above it the peaks stay under full scale
 * instead of clipping the output (a drum kit and a bass 13 dB over came out
 * below -0.9 dBFS). No attack time, since a drum hit overshoots otherwise.
 */
const LIMITER = {
  attack: 0,
  knee: 0,
  ratio: 20,
  release: 0.1,
  threshold: -3,
};
/**
 * A compressor adds a make-up gain of its own, fixed for these settings
 * (+1.7 dB, measured with an offline render): the trim takes it back out, so
 * the limiter changes nothing below its threshold.
 */
const LIMITER_TRIM = 10 ** (-1.7 / 20);

/**
 * A master output bus: one persistent GainNode kept in sync with a volume
 * control, then a safety limiter, then the shared AudioContext's destination.
 * Every sound source a block produces, synth voices, drum hits, connects into
 * the returned node instead of reaching `ctx.destination` directly, so a
 * single Fader governs the whole block's level and a loud mix cannot clip the
 * output. The limiter delays the sound by a few milliseconds. Returns `null`
 * until the shared AudioContext exists (SSR, or before the first client
 * render).
 */
export function useMasterBus(volume: number): GainNode | null {
  const [masterGain, setMasterGain] = useState<GainNode | null>(null);

  // Seeds the node's initial gain from the volume at mount without recreating
  // the node on every volume change, the sync effect below owns changes.
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = volumeRef.current;
    const limiter = ctx.createDynamicsCompressor();
    limiter.attack.value = LIMITER.attack;
    limiter.knee.value = LIMITER.knee;
    limiter.ratio.value = LIMITER.ratio;
    limiter.release.value = LIMITER.release;
    limiter.threshold.value = LIMITER.threshold;
    const trim = ctx.createGain();
    trim.gain.value = LIMITER_TRIM;
    gain.connect(limiter).connect(trim).connect(ctx.destination);
    setMasterGain(gain);
    return () => {
      gain.disconnect();
      limiter.disconnect();
      trim.disconnect();
    };
  }, []);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && masterGain)) {
      return;
    }
    masterGain.gain.setTargetAtTime(
      volume,
      ctx.currentTime,
      VOLUME_RAMP_SECONDS
    );
  }, [volume, masterGain]);

  return masterGain;
}
