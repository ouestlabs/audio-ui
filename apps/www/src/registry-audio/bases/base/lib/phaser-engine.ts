import type { DeviceContext } from "@audio-ui/core/device";
import { DEFAULT_TEMPO } from "@audio-ui/core/time";
import {
  PHASER_STAGES,
  type PhaserState,
  phaserSettings,
} from "@/registry-audio/bases/base/lib/phaser-device";

const RAMP_SECONDS = 0.03;

export interface PhaserEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: PhaserState, context?: DeviceContext) => void;
}

/**
 * A phaser and flanger on the Web Audio API for a `PhaserState`. Both paths
 * are always built and the mode crossfades them:
 *
 * ```
 * input → dry ───────────────────────────────────────────────┐
 *       → all-pass x4 → phaser wet (feedback to the first) ──┤
 *       → delay → flanger wet (feedback to itself) ──────────┴→ output
 *             ↑ oscillator: cents on each stage, seconds on the delay
 * ```
 */
export function createPhaserEngine(
  ctx: BaseAudioContext,
  initial: PhaserState,
  context?: DeviceContext
): PhaserEngine {
  let tempo = context?.tempo ?? DEFAULT_TEMPO;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";

  const phaserIn = ctx.createGain();
  const stages = Array.from({ length: PHASER_STAGES }, () => {
    const stage = ctx.createBiquadFilter();
    stage.type = "allpass";
    return stage;
  });
  const phaserFeedback = ctx.createGain();
  const phaserWet = ctx.createGain();
  const phaserSweep = ctx.createGain();
  [phaserIn, ...stages].reduce((from, to) => {
    from.connect(to);
    return to;
  });
  const last = stages.at(-1);
  last?.connect(phaserWet).connect(output);
  last?.connect(phaserFeedback).connect(phaserIn);
  oscillator.connect(phaserSweep);
  for (const stage of stages) {
    phaserSweep.connect(stage.detune);
  }

  const delay = ctx.createDelay(0.05);
  const flangerFeedback = ctx.createGain();
  const flangerWet = ctx.createGain();
  const flangerSweep = ctx.createGain();
  delay.connect(flangerWet).connect(output);
  delay.connect(flangerFeedback).connect(delay);
  oscillator.connect(flangerSweep).connect(delay.delayTime);

  input.connect(dry).connect(output);
  input.connect(phaserIn);
  input.connect(delay);

  const set = (
    state: PhaserState,
    write: (param: AudioParam, value: number) => void
  ) => {
    const settings = phaserSettings(state, tempo);
    oscillator.frequency.value = settings.rate;
    write(dry.gain, settings.dry);
    write(phaserWet.gain, settings.phaserWet);
    write(flangerWet.gain, settings.flangerWet);
    write(phaserFeedback.gain, settings.feedback);
    write(flangerFeedback.gain, settings.feedback);
    write(phaserSweep.gain, settings.phaserSweepCents);
    write(flangerSweep.gain, settings.flangerSweep);
    write(delay.delayTime, settings.delay);
    for (const stage of stages) {
      write(stage.frequency, settings.center);
    }
  };
  set(initial, (param, value) => {
    param.value = value;
  });
  oscillator.start();

  return {
    dispose: () => {
      oscillator.stop();
      for (const node of [
        input,
        dry,
        oscillator,
        phaserIn,
        ...stages,
        phaserFeedback,
        phaserWet,
        phaserSweep,
        delay,
        flangerFeedback,
        flangerWet,
        flangerSweep,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state, next) => {
      tempo = next?.tempo ?? tempo;
      set(state, (param, value) =>
        param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS)
      );
      oscillator.frequency.setTargetAtTime(
        phaserSettings(state, tempo).rate,
        ctx.currentTime,
        RAMP_SECONDS
      );
    },
  };
}
