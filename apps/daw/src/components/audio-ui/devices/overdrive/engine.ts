import type { EffectEngine } from "@audio-ui/engine/device";
import {
  type OverdriveState,
  overdriveSettings,
  overdriveTable,
  TABLE_DOMAIN,
} from "@/components/audio-ui/devices/overdrive/device";
import { createOversamplingDelay } from "@/lib/oversampling";

const RAMP_SECONDS = 0.015;

export type OverdriveEngine = EffectEngine<OverdriveState>;

/**
 * An overdrive on the Web Audio API for an `OverdriveState`:
 *
 * ```
 * input → band-pass → drive → shaper (4x) → tone (low-pass) → wet ──┐
 *       → dry ──────────────────────────────────────────────────────┴→ output
 * ```
 *
 * Only what the band-pass lets through is pushed into the clip, so the lows
 * stay clean in the dry path and the clip does not choke on them.
 */
export function createOverdriveEngine(
  ctx: BaseAudioContext,
  initial: OverdriveState
): OverdriveEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const band = ctx.createBiquadFilter();
  const drive = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const tone = ctx.createBiquadFilter();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  const dryDelay = createOversamplingDelay(ctx, "4x");
  band.type = "bandpass";
  tone.type = "lowpass";
  shaper.curve = overdriveTable();
  shaper.oversample = "4x";
  input.connect(band).connect(drive).connect(shaper).connect(tone).connect(wet);
  wet.connect(output);
  input.connect(dryDelay).connect(dry).connect(output);

  const first = overdriveSettings(initial);
  band.frequency.value = first.bandHz;
  band.Q.value = first.q;
  drive.gain.value = first.drive / TABLE_DOMAIN;
  tone.frequency.value = first.tone;
  wet.gain.value = first.wet;
  dry.gain.value = first.dry;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [input, band, drive, shaper, tone, wet, dry, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      const settings = overdriveSettings(state);
      follow(band.frequency, settings.bandHz);
      follow(band.Q, settings.q);
      follow(drive.gain, settings.drive / TABLE_DOMAIN);
      follow(tone.frequency, settings.tone);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
    },
  };
}
