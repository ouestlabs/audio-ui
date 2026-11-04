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