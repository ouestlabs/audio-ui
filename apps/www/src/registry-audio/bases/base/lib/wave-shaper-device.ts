import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const MIN_FREQUENCY = 55;
const MAX_FREQUENCY = 880;
const MIN_RESONANCE = 0.5;
const RESONANCE_RANGE = 15;
const CURVE_SAMPLES = 44_100;
const DEGREES = Math.PI / 180;

/**
 * A wave shaper synth as a device: two detuned oscillators, a distortion mixed
 * in parallel, a low-pass filter and a level, with no panel and no audio in
 * it. It is an instrument, so it is played with notes (a pitch and a filter
 * resonance, see `waveShaperPitch`) and these parameters shape the timbre.
 */
export const waveShaperDevice = defineDevice({
  description:
    "A monophonic synth: two detuned oscillators of a chosen waveform, a distortion mixed in with the clean sound, a low-pass filter with a tone and a resonance, played by pitch and resonance, at a level.",
  id: "audioui.wave-shaper",
  kind: "instrument",
  name: "Wave Shaper",
  parameters: [
    {
      default: "sine",
      id: "wave",
      kind: "choice",
      label: "Wave",
      options: [
        { label: "Sine", value: "sine" },
        { label: "Triangle", value: "triangle" },
        { label: "Saw", value: "sawtooth" },
        { label: "Square", value: "square" },
      ],
    },
    {
      default: 1,
      id: "drive",
      label: "Drive",
      max: 100,
      min: 0,
      step: 1,
    },
    {
      default: 50,
      id: "tone",
      label: "Tone",
      max: 100,
      min: 0,
      step: 1,
    },
    {
      anchor: 0,
      default: 0,
      id: "detune",
      label: "Detune",
      max: 50,
      min: -50,
      step: 1,
      unit: "ct",
    },
    {
      default: 50,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 0.5,
      format: (volume: number) => `${Math.round(volume * 100)}%`,
      id: "volume",
      label: "Volume",
      max: 1,
      min: 0,
      step: 0.01,
    },
  ],
});

export type WaveShaperState = DeviceState<typeof waveShaperDevice.parameters>;

/** What is played: a pitch in hertz and the resonance of the filter (its Q). */
export interface WaveShaperNote {
  frequency: number;
  resonance: number;
}

/** The pitch at a position from 0 to 1 along a log axis from 55 Hz to 880 Hz. */
export const waveShaperPitch = (position: number) =>
  MIN_FREQUENCY * (MAX_FREQUENCY / MIN_FREQUENCY) ** position;

/** The resonance at a position from 0 to 1, from 0.5 to 15.5. */
export const waveShaperResonance = (position: number) =>
  MIN_RESONANCE + position * RESONANCE_RANGE;

/** The cutoff in hertz of the low-pass filter for a tone from 0 to 100. */
export const waveShaperCutoff = (tone: number) => 500 + tone * 75;

/** The distortion curve for a drive from 0 to 100, as a table for a `WaveShaperNode`. */
export function waveShaperCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  for (let index = 0; index < CURVE_SAMPLES; index += 1) {
    const x = (index * 2) / CURVE_SAMPLES - 1;
    curve[index] =
      ((3 + drive) * x * 20 * DEGREES) / (Math.PI + drive * Math.abs(x));
  }
  return curve;
}
