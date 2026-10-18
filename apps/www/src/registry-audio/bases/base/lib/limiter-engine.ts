import {
  type LimiterState,
  limiterSettings,
} from "@/registry-audio/bases/base/lib/limiter-device";

const RAMP_SECONDS = 0.01;

import type { DeviceReadings } from "@audio-ui/core/device";

export interface LimiterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** How many dB the limiter is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  update: (state: LimiterState) => void;
}

/**
 * A limiter on the Web Audio API for a `LimiterState`:
 *
 * ```
 * input → gain → compressor (ratio 20, no knee) → trim → clip → wet ──┐
 *       → bypass ─────────────────────────────────────────────────────┴→ output
 * ```
 *
 * The node adds a make-up of its own that cannot be turned off: the trim
 * takes it back out. A ratio of 20 is not a wall: a loud enough signal still
 * gets over the ceiling, so a final hard clip, oversampled 4x, guarantees that
 * no sample is above it. That is a sample peak, not an inter-sample (true)
 * peak. Off, the signal goes round it.
 */
export function createLimiterEngine(
  ctx: BaseAudioContext,
  initial: LimiterState
): LimiterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const gain = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  const trim = ctx.createGain();
  const scale = ctx.createGain();
  const clip = ctx.createWaveShaper();
  const unscale = ctx.createGain();
  const wet = ctx.createGain();
  const bypass = ctx.createGain();
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0;
  // Two points, the line from -1 to 1: a value past either end is held at it.
  clip.curve = new Float32Array([-1, 1]);
  clip.oversample = "4x";
  input
    .connect(gain)
    .connect(limiter)
    .connect(trim)
    .connect(scale)
    .connect(clip)
    .connect(unscale)
    .connect(wet)
    .connect(output);
  input.connect(bypass).connect(output);

  const first = limiterSettings(initial);
  gain.gain.value = first.gain;
  limiter.threshold.value = first.threshold;
  limiter.release.value = first.release;
  trim.gain.value = first.trim;
  scale.gain.value = 1 / first.ceiling;
  unscale.gain.value = first.ceiling;
  wet.gain.value = first.wet;
  bypass.gain.value = 1 - first.wet;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [
        input,
        gain,
        limiter,
        trim,
        scale,
        clip,
        unscale,
        wet,
        bypass,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return limiter.reduction;
    },
    readings: (): DeviceReadings => ({ gainReductionDb: limiter.reduction }),
    update: (state) => {
      const settings = limiterSettings(state);
      follow(gain.gain, settings.gain);
      follow(limiter.threshold, settings.threshold);
      follow(limiter.release, settings.release);
      follow(trim.gain, settings.trim);
      follow(scale.gain, 1 / settings.ceiling);
      follow(unscale.gain, settings.ceiling);
      follow(wet.gain, settings.wet);
      follow(bypass.gain, 1 - settings.wet);
    },
  };
}
