import {
  type BiquadType,
  biquadResponse,
  formatHz,
} from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const TABLE_SAMPLES = 4096;
const BAND_TYPE: BiquadType = "bandpass";

/**
 * An overdrive as a device: a band-pass filter before a soft clip, which is how
 * a distortion pedal keeps the lows from turning to mud, then a tone, a mix
 * and a drive, with no panel and no audio in it.
 */
export const overdriveDevice = defineDevice({
  description:
    "A pedal-style distortion: a band-pass filter picks what is pushed into the soft clip (its frequency and width), the drive sets how hard, the tone closes the highs after it, mixed with the clean sound.",
  id: "audioui.overdrive",
  name: "Overdrive",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 800,
      format: formatHz,
      id: "bandHz",
      label: "Band",
      max: 8000,
      min: 100,
      scale: "log",
      step: 1,
    },
    {
      default: 0.8,
      format: (q: number) => q.toFixed(2),
      id: "width",
      label: "Width",
      max: 6,
      min: 0.3,
      scale: "log",
      step: 0.01,
    },
    {
      default: 14,
      id: "driveDb",
      label: "Drive",
      max: 40,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 4500,
      format: formatHz,
      id: "toneHz",
      label: "Tone",
      max: 20_000,
      min: 500,
      scale: "log",
      step: 10,
    },
    {
      default: 80,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type OverdriveState = DeviceState<typeof overdriveDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, the clean sound passes. */
export function overdriveSettings(state: OverdriveState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    bandHz: state.bandHz,
    dry: 1 - mix,
    drive: 10 ** (state.driveDb / 20),
    q: state.width,
    tone: state.toneHz,
    wet: mix,
  };
}

/** The clip as a table for a `WaveShaperNode`: one fixed shape, the drive being a gain before it. */
export function overdriveTable(): Float32Array<ArrayBuffer> {
  const table = new Float32Array(new ArrayBuffer(TABLE_SAMPLES * 4));
  for (let index = 0; index < TABLE_SAMPLES; index += 1) {
    table[index] = Math.tanh((index * 2) / (TABLE_SAMPLES - 1) - 1);
  }
  return table;
}

/** What the band-pass lets into the clip, in dB at each frequency: what the panel draws. */
export function overdriveBand(state: OverdriveState) {
  return biquadResponse({
    frequency: state.bandHz,
    q: state.width,
    type: BAND_TYPE,
  });
}
