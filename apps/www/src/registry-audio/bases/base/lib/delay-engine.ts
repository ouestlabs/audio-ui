import {
  type DelayState,
  delaySettings,
  MAX_DELAY_SECONDS,
} from "@/registry-audio/bases/base/lib/delay-device";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.02;
/** A change of time glides slower, so the echo bends like a tape instead of clicking. */
const TIME_RAMP_SECONDS = 0.08;

export interface DelayEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: DelayState) => void;
}

/**
 * A delay on the Web Audio API for a `DelayState`:
 *
 * ```
 * input → dry ─────────────────────────────────────┐
 *       → delay → tone (low-pass) → wet ───────────┴→ output
 *             ↑            └→ feedback ─┘
 * ```
 *
 * The repeats go round the loop through the tone filter, so each is darker than
 * the one before. Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createDelayEngine(
  ctx: BaseAudioContext,
  initial: DelayState
): DelayEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(MAX_DELAY_SECONDS + 1);
  const tone = ctx.createBiquadFilter();
  const feedback = ctx.createGain();
  tone.type = "lowpass";

  input.connect(dry).connect(output);
  input.connect(delay).connect(tone).connect(wet).connect(output);
  tone.connect(feedback).connect(delay);

  const apply = (
    state: DelayState,
    set: (param: AudioParam, value: number, ramp: number) => void
  ) => {
    const settings = delaySettings(state);
    set(delay.delayTime, settings.delay, TIME_RAMP_SECONDS);
    set(tone.frequency, settings.tone, RAMP_SECONDS);
    set(feedback.gain, settings.feedback, RAMP_SECONDS);
    set(dry.gain, settings.dry, RAMP_SECONDS);
    set(wet.gain, settings.wet, RAMP_SECONDS);
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
  apply(initial, (param, value) => {
    param.value = value;
  });

  return {
    dispose: () => {
      for (const node of [input, dry, delay, tone, feedback, wet, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) =>
      apply(state, (param, value, ramp) =>
        param.setTargetAtTime(value, ctx.currentTime, ramp)
      ),
  };
}
