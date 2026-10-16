import {
  type ChorusState,
  chorusSettings,
} from "@/registry-audio/bases/base/lib/chorus-device";

const RAMP_SECONDS = 0.03;

export interface ChorusEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: ChorusState) => void;
}

/**
 * A chorus on the Web Audio API for a `ChorusState`:
 *
 * ```
 * input → dry ──────────────────────────────┐
 *       → delay → wet ──────────────────────┴→ output
 *           ↑ sweep ← oscillator (the rate)
 * ```
 *
 * The oscillator's output, scaled by the sweep, is added to the delay time.
 */
export function createChorusEngine(
  ctx: BaseAudioContext,
  initial: ChorusState
): ChorusEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(0.1);
  const oscillator = ctx.createOscillator();
  const sweep = ctx.createGain();
  oscillator.type = "sine";
  input.connect(dry).connect(output);
  input.connect(delay).connect(wet).connect(output);
  oscillator.connect(sweep).connect(delay.delayTime);

  const first = chorusSettings(initial);
  delay.delayTime.value = first.delay;
  oscillator.frequency.value = first.rate;
  sweep.gain.value = first.sweep;
  dry.gain.value = first.dry;
  wet.gain.value = first.wet;
  oscillator.start();

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      oscillator.stop();
      for (const node of [input, dry, delay, wet, sweep, oscillator, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      const settings = chorusSettings(state);
      follow(delay.delayTime, settings.delay);
      follow(oscillator.frequency, settings.rate);
      follow(sweep.gain, settings.sweep);
      follow(dry.gain, settings.dry);
      follow(wet.gain, settings.wet);
    },
  };
}
