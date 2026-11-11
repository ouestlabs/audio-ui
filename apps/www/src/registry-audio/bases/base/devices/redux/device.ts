import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { REDUX_KERNELS } from "@audio-ui/engine/kernels";

/** The table of the quantizer has this many steps: finer than 16 bits can tell apart on a plot. */
const TABLE_STEPS = 2 ** 16;

/**
 * A redux as a device: it takes the sound down to fewer bits and a lower
 * sample rate, the way early samplers sounded, with no panel and no audio in
 * it.
 */
export const reduxDevice = defineDevice({
  description:
    "Roughens the sound like an early sampler: it keeps only a number of bits of each sample, rounded to the nearest level or shaped so the noise goes to the highs, and holds each sample for a number of samples, mixed with the clean sound.",
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
      default: "nearest",
      id: "quantize",
      kind: "choice",
      label: "Quantize",
      options: [
        { label: "Nearest", value: "nearest" },
        { label: "Shaped", value: "shaped" },
      ],
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
  return {
    bits: state.bits,
    dry: 1 - mix,
    hold: state.hold,
    shaped: state.quantize === "shaped",
    wet: mix,
  };
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
 * The processor of the redux, as the source of an `AudioWorklet` module: it
 * holds each sample for `hold` samples with the bitcrusher of
 * `@audio/effect-bitcrusher` at 24 bits, finer than any rounding to come, and
 * when the quantizer is shaped, rounds to `bits` with the error feedback of
 * `@audio/effect-noiseshaper`, so the rounding noise goes to the highs. A
 * message `{ shaped }` switches it. The engine loads it from a blob, so there
 * is no file to serve.
 */
export const REDUX_WORKLET = `${REDUX_KERNELS}
class AudioUiRedux extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "hold", defaultValue: 1, minValue: 1, maxValue: 64, automationRate: "k-rate" },
      { name: "bits", defaultValue: 16, minValue: 1, maxValue: 24, automationRate: "k-rate" },
    ];
  }
  constructor(options) {
    super();
    this.shaped = Boolean(options?.processorOptions?.shaped);
    this.channels = [];
    this.port.onmessage = ({ data }) => {
      this.shaped = Boolean(data.shaped);
    };
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(output && output.length > 0)) {
      return true;
    }
    const hold = Math.max(1, parameters.hold[0]);
    const bits = parameters.bits[0];
    for (let channel = 0; channel < output.length; channel += 1) {
      const data = output[channel];
      const from = input && input.length > 0 ? input[channel % input.length] : null;
      if (from) {
        data.set(from);
      } else {
        data.fill(0);
      }
      this.channels[channel] ??= { crush: { fs: sampleRate }, shape: { fs: sampleRate } };
      const state = this.channels[channel];
      state.crush.bits = 24;
      state.crush.rate = 1 / hold;
      bitcrusher(data, state.crush);
      if (this.shaped) {
        state.shape.bits = bits;
        noiseShaping(data, state.shape);
      }
    }
    return true;
  }
}
registerProcessor("audioui-redux", AudioUiRedux);
`;
