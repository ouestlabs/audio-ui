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

/** A master output bus: the node every source connects to, its volume, and what takes it away. */
export interface MasterBus {
  /** Takes the bus off the destination. */
  dispose: () => void;
  /** The node every sound connects to instead of `ctx.destination`. */
  input: GainNode;
  /** Moves the volume, 0 to 1, with a short ramp so it makes no click. */
  setVolume: (volume: number) => void;
}

/**
 * A master output bus on `ctx`: a gain for the volume, then a safety limiter,
 * then the destination. Every source of a screen (synth voices, drum hits, a
 * device) connects to `input`, so one control governs the level and a loud
 * mix cannot clip the output. The limiter delays the sound by a few
 * milliseconds.
 */
export function createMasterBus(
  ctx: BaseAudioContext,
  volume: number
): MasterBus {
  const input = ctx.createGain();
  input.gain.value = volume;
  const limiter = ctx.createDynamicsCompressor();
  limiter.attack.value = LIMITER.attack;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.release.value = LIMITER.release;
  limiter.threshold.value = LIMITER.threshold;
  const trim = ctx.createGain();
  trim.gain.value = LIMITER_TRIM;
  input.connect(limiter).connect(trim).connect(ctx.destination);
  return {
    dispose: () => {
      input.disconnect();
      limiter.disconnect();
      trim.disconnect();
    },
    input,
    setVolume: (next) =>
      input.gain.setTargetAtTime(next, ctx.currentTime, VOLUME_RAMP_SECONDS),
  };
}
