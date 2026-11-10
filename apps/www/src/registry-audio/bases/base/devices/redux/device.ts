import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The table of the quantizer has this many steps: finer than 16 bits can tell apart on a plot. */
const TABLE_STEPS = 2 ** 16;

/**
 * A redux as a device: it takes the sound down to fewer bits and a lower
 * sample rate, the way early samplers sounded, with no panel and no audio in
 * it.
 */
export const reduxDevice = defineDevice({
  description:
    "Roughens the sound like an early sampler: it keeps only a number of bits of each sample and holds each sample for a number of samples, mixed with the clean sound.",
  id: "audioui.redux",
  name: "Redux",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 8,
      id: "bits",
      label: "Bits",
      max: 16,
      min: 1,
      step: 1,
    },
    {
      default: 4,
      format: (hold: number) => `${hold}x`,
      id: "hold",
      label: "Downsample",
      max: 64,
      min: 1,
      scale: "log",
      step: 1,
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
  ],
});

export type ReduxState = DeviceState<typeof reduxDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, the clean sound passes. */
export function reduxSettings(state: ReduxState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return { bits: state.bits, dry: 1 - mix, hold: state.hold, wet: mix };
}

/** One input from -1 to 1 kept to `bits` bits: the nearest of 2^bits levels. */
export function quantize(input: number, bits: number) {
  const steps = 2 ** (bits - 1);
  return Math.max(-1, Math.min(1, Math.round(input * steps) / steps));
}

/** The quantizer as a table for a `WaveShaperNode`. */
export function reduxTable(bits: number): Float32Array<ArrayBuffer> {
  const table = new Float32Array(new ArrayBuffer((TABLE_STEPS + 1) * 4));
  for (let index = 0; index <= TABLE_STEPS; index += 1) {
    table[index] = quantize((index * 2) / TABLE_STEPS - 1, bits);
  }
  return table;
}

/** The transfer curve a state plays: the output for an input from -1 to 1, the stairs of the bits mixed with the line of the clean sound. */
export function reduxCurve(state: ReduxState) {
  const { bits, dry, wet } = reduxSettings(state);
  return (input: number) => dry * input + wet * quantize(input, bits);
}

/**
 * The processor of the sample hold, as the source of an `AudioWorklet` module:
 * it keeps each sample for `hold` samples. The engine loads it from a blob, so
 * there is no file to serve.
 */
export const REDUX_WORKLET = `
class AudioUiRedux extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: "hold", defaultValue: 1, minValue: 1, maxValue: 64, automationRate: "k-rate" }];
  }
  constructor() {
    super();
    this.count = 0;
    this.held = [];
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const hold = Math.max(1, Math.round(parameters.hold[0]));
    const length = output[0] ? output[0].length : 0;
    for (let n = 0; n < length; n += 1) {
      if (this.count % hold === 0) {
        for (let c = 0; c < output.length; c += 1) {
          this.held[c] = input[c] ? input[c][n] : 0;
        }
      }
      this.count += 1;
      for (let c = 0; c < output.length; c += 1) {
        output[c][n] = this.held[c] || 0;
      }
    }
    return true;
  }
}
registerProcessor("audioui-redux", AudioUiRedux);
`;
