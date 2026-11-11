import type { EffectEngine } from "@audio-ui/engine/device";
import {
  type SaturatorState,
  saturatorSettings,
  saturatorTable,
} from "@/components/audio-ui/devices/saturator/device";
import { createOversamplingDelay } from "@/lib/oversampling";

const RAMP_SECONDS = 0.015;

export type SaturatorEngine = EffectEngine<SaturatorState>;

/**
 * A saturator on the Web Audio API for a `SaturatorState`:
 *
 * ```
 * input → drive → shaper (4x) → wet ──┐
 *       → dry (waits as long as the shaper) ────────────────────────┴→ level → output
 * ```
 *
 * The drive is a gain before the table of the curve, so turning it never
 * rebuilds the table; only picking another curve does.
 */
export function createSaturatorEngine(
  ctx: BaseAudioContext,
  initial: SaturatorState
): SaturatorEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const drive = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  const dryDelay = createOversamplingDelay(ctx, "4x");
  const level = ctx.createGain();
  shaper.oversample = "4x";
  shaper.curve = saturatorTable(initial.curve);
  let { curve } = initial;
  input.connect(drive).connect(shaper).connect(wet).connect(level);
  input.connect(dryDelay).connect(dry).connect(level);
  level.connect(output);

  const first = saturatorSettings(initial);
  drive.gain.value = first.drive;
  wet.gain.value = first.wet;
  dry.gain.value = first.dry;
  level.gain.value = first.output;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [
        input,
        dryDelay,
        drive,
        shaper,
        wet,
        dry,
        level,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      if (state.curve !== curve) {
        ({ curve } = state);
        shaper.curve = saturatorTable(curve);
      }
      const settings = saturatorSettings(state);
      follow(drive.gain, settings.drive);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
      follow(level.gain, settings.output);
    },
  };
}
