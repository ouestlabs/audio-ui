import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { oversamplingSeconds } from "@/registry-audio/bases/base/lib/oversampling";

const CURVE_SAMPLES = 4096;

/** The table covers the signal after the drive from -8 to 8, so a driven peak is still on the curve instead of held at its edge. */
export const TABLE_DOMAIN = 8;

/**
 * A distortion as a device: a drive that pushes the signal into a soft clip, a
 * tone, a mix and an output level, with no panel and no audio in it.
 */
export const distortionDevice = defineDevice({
  description:
    "Bends the sound: the drive pushes the signal into a soft clip that rounds its peaks, the tone closes the highs after it, mixed with the clean sound at an output level.",
  id: "audioui.distortion",
  // The shaper oversamples 4x and the dry path waits as long: the delay is the same on or off.
  latency: (_state, sampleRate) => oversamplingSeconds("4x", sampleRate),
  name: "Distortion",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 12,
      id: "driveDb",
      label: "Drive",
      max: 40,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 6000,
      format: formatHz,
      id: "toneHz",
      label: "Tone",
      max: 20_000,
      min: 500,
      scale: "log",
      step: 10,
    },
    {
      default: 100,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      anchor: 0,
      default: -6,
      id: "outputDb",
      label: "Output",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
  ],
});

export type DistortionState = DeviceState<typeof distortionDevice.parameters>;

const gainOf = (db: number) => 10 ** (db / 20);

/** The numbers that go on the nodes for a state. Off, the clean sound passes at unity. */
export function distortionSettings(state: DistortionState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    dry: 1 - mix,
    drive: gainOf(state.driveDb),
    output: state.enabled ? gainOf(state.outputDb) : 1,
    tone: state.toneHz,
    wet: mix,
  };
}

/** The soft clip: the output for an input from -1 to 1 at a drive gain, normalised so full scale in is full scale out. */
export function softClip(input: number, drive: number) {
  return Math.tanh(drive * input) / Math.tanh(drive);
}

/** The clip as a table for a `WaveShaperNode`: tanh over the drive's range. The drive is a gain before it (divided by `TABLE_DOMAIN`), so the table is one fixed shape. */
export function distortionTable(): Float32Array<ArrayBuffer> {
  const table = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  for (let index = 0; index < CURVE_SAMPLES; index += 1) {
    table[index] = Math.tanh(
      TABLE_DOMAIN * ((index * 2) / (CURVE_SAMPLES - 1) - 1)
    );
  }
  return table;
}

/**
 * The transfer curve a state plays: the output for an input from -1 to 1, the
 * drive through the clip, then the mix with the clean sound and the output.
 */
export function distortionCurve(state: DistortionState) {
  const { dry, drive, output, wet } = distortionSettings(state);
  return (input: number) => {
    const shaped = Math.tanh(drive * input);
    return output * (dry * input + wet * shaped);
  };
}
