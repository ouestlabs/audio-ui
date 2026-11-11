import distortion from "@audio/effect-distortion";
import { formatHz } from "@audio-ui/engine/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { oversamplingSeconds } from "@/lib/oversampling";

const TABLE_SAMPLES = 16_384;

/**
 * The table covers the signal after the drive from -100 to 100, the gain of
 * the drive at its top (40 dB): a full-scale input at full drive is still on
 * the curve, where a fold keeps folding instead of holding at the table's edge.
 */
export const TABLE_DOMAIN = 100;

/**
 * A distortion as a device: a drive that pushes the signal into one of four
 * curves, a tone, a mix and an output level, with no panel and no audio in it.
 */
export const distortionDevice = defineDevice({
  description:
    "Bends the sound: the drive pushes the signal into a curve (a tanh or a cubic soft clip, a hard clip or a wavefold), the tone closes the highs after it, mixed with the clean sound at an output level.",
  id: "audioui.distortion",
  // The shaper oversamples 4x and the dry path waits as long: the delay is the same on or off.
  latency: (_state, sampleRate) => oversamplingSeconds("4x", sampleRate),
  name: "Distortion",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "tanh",
      id: "curve",
      kind: "choice",
      label: "Curve",
      options: [
        { label: "Tanh", value: "tanh" },
        { label: "Cubic", value: "soft" },
        { label: "Hard", value: "hard" },
        { label: "Fold", value: "foldback" },
      ],
    },
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

const tables = new Map<DistortionState["curve"], Float32Array<ArrayBuffer>>();

/**
 * A curve as a table for a `WaveShaperNode`, written by the curve of
 * `@audio/effect-distortion` itself. The drive is a gain before it (divided by
 * `TABLE_DOMAIN`), so the table depends on the curve alone. Each curve's table
 * is made once and shared: a node copies the table it is given.
 */
export function distortionTable(
  curve: DistortionState["curve"]
): Float32Array<ArrayBuffer> {
  const made = tables.get(curve);
  if (made) {
    return made;
  }
  const table = new Float32Array(new ArrayBuffer(TABLE_SAMPLES * 4));
  for (let index = 0; index < TABLE_SAMPLES; index += 1) {
    table[index] = TABLE_DOMAIN * ((index * 2) / (TABLE_SAMPLES - 1) - 1);
  }
  // A drive of 0 is a gain of 1 and a mix of 1 is no dry: the curve alone.
  distortion(table, { drive: 0, mix: 1, type: curve });
  tables.set(curve, table);
  return table;
}

/**
 * A curve at an input after the drive, read from its table as a
 * `WaveShaperNode` reads it, between two entries: what the node plays.
 */
export function distortionShape(
  curve: DistortionState["curve"],
  input: number
) {
  const table = distortionTable(curve);
  const position = Math.max(
    0,
    Math.min(
      TABLE_SAMPLES - 1,
      ((input / TABLE_DOMAIN + 1) * (TABLE_SAMPLES - 1)) / 2
    )
  );
  const index = Math.min(Math.floor(position), TABLE_SAMPLES - 2);
  const fraction = position - index;
  return (
    (table[index] ?? 0) * (1 - fraction) + (table[index + 1] ?? 0) * fraction
  );
}

/**
 * The transfer curve a state plays: the output for an input from -1 to 1, the
 * drive through the curve, then the mix with the clean sound and the output.
 */
export function distortionCurve(state: DistortionState) {
  const { dry, drive, output, wet } = distortionSettings(state);
  return (input: number) =>
    output * (dry * input + wet * distortionShape(state.curve, drive * input));
}