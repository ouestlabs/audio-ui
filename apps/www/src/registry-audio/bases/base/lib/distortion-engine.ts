import {
  type DistortionState,
  distortionSettings,
  distortionTable,
} from "@/registry-audio/bases/base/lib/distortion-device";

const RAMP_SECONDS = 0.015;

export interface DistortionEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: DistortionState) => void;
}

/**
 * A distortion on the Web Audio API for a `DistortionState`:
 *
 * ```
 * input → drive → shaper (4x) → tone (low-pass) → wet ──┐
 *       → dry ──────────────────────────────────────────┴→ level → output
 * ```
 *
 * The drive is a gain before a fixed soft-clip table, so turning it never
 * rebuilds the table. The shaper oversamples 4x to keep the clip from aliasing.
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
  const level = ctx.createGain();
  shaper.curve = distortionTable();
  shaper.oversample = "4x";
  tone.type = "lowpass";
  input
    .connect(drive)
    .connect(shaper)
    .connect(tone)
    .connect(wet)
    .connect(level);
  input.connect(dry).connect(level);
  level.connect(output);

  const first = distortionSettings(initial);
  drive.gain.value = first.drive;
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
      follow(drive.gain, settings.drive);
      follow(tone.frequency, settings.tone);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
      follow(level.gain, settings.output);
    },
  };
}
