/**
 * What a `WaveShaperNode` that oversamples costs in time. Its resampling
 * filters delay the signal, and a shaper that sits on one path of a parallel
 * mix (a distortion with a dry sound beside it) puts the two out of step: the
 * mix combs. The dry path waits as long, so the two meet.
 *
 * The delay is in samples, so it follows the sample rate. The numbers were
 * measured in Chrome (an impulse through the node peaks at sample 128 with 2x
 * and 192 with 4x); the specification does not give them, so another browser
 * may differ, and `measureLatency` of `device-measure` is how to read it there.
 */
const SAMPLES: Record<OverSampleType, number> = {
  "2x": 128,
  "4x": 192,
  none: 0,
};

/** The delay in seconds a `WaveShaperNode` adds when it oversamples at `amount`, at a sample rate. Pure, so a device can declare it as its latency. */
export function oversamplingSeconds(
  amount: OverSampleType,
  sampleRate: number
): number {
  return SAMPLES[amount] / sampleRate;
}

/** The delay in seconds a `WaveShaperNode` adds when it oversamples at `amount`, in a context. */
export function oversamplingDelay(
  ctx: BaseAudioContext,
  amount: OverSampleType
): number {
  return oversamplingSeconds(amount, ctx.sampleRate);
}

/** A delay node that holds a dry path back by the oversampling of a shaper. Connect the dry path through it. */
export function createOversamplingDelay(
  ctx: BaseAudioContext,
  amount: OverSampleType
): DelayNode {
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = oversamplingDelay(ctx, amount);
  return delay;
}
