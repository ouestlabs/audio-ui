import {
  type DistortionState,
  distortionSettings,
  distortionTable,
  TABLE_DOMAIN,
} from "@/registry-audio/bases/base/devices/distortion/device";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";
import { createOversamplingDelay } from "@/registry-audio/bases/base/lib/oversampling";

const RAMP_SECONDS = 0.015;

export type DistortionEngine = EffectEngine<DistortionState>;

/**
 * A distortion on the Web Audio API for a `DistortionState`:
 *
 * ```
 * input → drive → shaper (4x) → tone (low-pass) → wet ──┐
 *       → dry (waits as long as the shaper) ──────────────────────────────────────────┴→ level → output
 * ```
 *
 * The drive is a gain before the table of the curve, so turning it never
 * changes the table; only picking another curve does. The shaper oversamples
 * 4x to keep the curve from aliasing.
 */
export function createDistortionEngine(
  ctx: BaseAudioContext,
  initial: DistortionState
): DistortionEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const drive = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const tone = ctx.createBiquadFilter();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  const dryDelay = createOversamplingDelay(ctx, "4x");
  const level = ctx.createGain();
  shaper.curve = distortionTable(initial.curve);
  let { curve } = initial;
  shaper.oversample = "4x";
  tone.type = "lowpass";
  input
    .connect(drive)
    .connect(shaper)
    .connect(tone)
    .connect(wet)
    .connect(level);
  input.connect(dryDelay).connect(dry).connect(level);
  level.connect(output);

  const first = distortionSettings(initial);
  drive.gain.value = first.drive / TABLE_DOMAIN;
  tone.frequency.value = first.tone;
  wet.gain.value = first.wet;
  dry.gain.value = first.dry;
  level.gain.value = first.output;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [
        input,
        drive,
        shaper,
        tone,
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
      const settings = distortionSettings(state);
      if (state.curve !== curve) {
        ({ curve } = state);
        shaper.curve = distortionTable(curve);
      }
      follow(drive.gain, settings.drive / TABLE_DOMAIN);
      follow(tone.frequency, settings.tone);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
      follow(level.gain, settings.output);
    },
  };
}
