import {
  type LimiterState,
  limiterSettings,
} from "@/registry-audio/bases/base/lib/limiter-device";

const RAMP_SECONDS = 0.01;

export interface LimiterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** How many dB the limiter is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  update: (state: LimiterState) => void;
}

/**
 * A limiter on the Web Audio API for a `LimiterState`:
 *
 * ```
 * input → gain → compressor (ratio 20, no knee) → trim → wet ──┐
 *       → bypass ──────────────────────────────────────────────┴→ output
 * ```
 *
 * The node adds a make-up of its own that cannot be turned off: the trim
 * takes it back out. Off, the signal goes round it.
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
  const wet = ctx.createGain();
  const bypass = ctx.createGain();
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0;
  input
    .connect(gain)
    .connect(limiter)
    .connect(trim)
    .connect(wet)
    .connect(output);
  input.connect(bypass).connect(output);

  const first = limiterSettings(initial);
  gain.gain.value = first.gain;
  limiter.threshold.value = first.threshold;
  limiter.release.value = first.release;
  trim.gain.value = first.trim;
  wet.gain.value = first.wet;
  bypass.gain.value = 1 - first.wet;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [input, gain, limiter, trim, wet, bypass, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return limiter.reduction;
    },
    update: (state) => {
      const settings = limiterSettings(state);
      follow(gain.gain, settings.gain);
      follow(limiter.threshold, settings.threshold);
      follow(limiter.release, settings.release);
      follow(trim.gain, settings.trim);
      follow(wet.gain, settings.wet);
      follow(bypass.gain, 1 - settings.wet);
    },
  };
}
