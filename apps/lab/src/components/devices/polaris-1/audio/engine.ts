import { loadWorklet } from "@/lib/engine/worklet";
import { type PolarisParam, type PolarisState, polarisDevice } from "./device";

/**
 * The engine of Polaris-1: the kernel compiled by jz, in an `AudioWorklet`.
 * The worklet is written from the description: an `AudioParam` per parameter,
 * handed to the kernel's `set` in the description's order whenever one
 * changes, then the kernel's `tick` for every sample. The module is compiled
 * from its bytes inside the worklet, so nothing crosses but numbers.
 *
 * ```
 * loop → kernel (an AudioWorklet) → bus
 * ```
 */

const PROCESSOR = "lab-polaris";
const RAMP = 0.02;

const descriptors = polarisDevice.parameters.map((parameter) => ({
  automationRate: "k-rate",
  defaultValue: parameter.default,
  maxValue: parameter.max,
  minValue: parameter.min,
  name: parameter.id,
}));

const WORKLET = `
const DESCRIPTORS = ${JSON.stringify(descriptors)};
const IDS = DESCRIPTORS.map((descriptor) => descriptor.name);

class PolarisProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return DESCRIPTORS;
  }
  constructor(options) {
    super();
    const module = new WebAssembly.Module(options.processorOptions.wasm);
    this.kernel = new WebAssembly.Instance(module, {}).exports;
    this.values = new Float64Array(IDS.length).fill(Number.NaN);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    let changed = false;
    for (let index = 0; index < IDS.length; index += 1) {
      const value = parameters[IDS[index]][0];
      if (value !== this.values[index]) {
        this.values[index] = value;
        changed = true;
      }
    }
    if (changed) {
      this.kernel.set(...this.values, sampleRate);
    }
    for (let channel = 0; channel < output.length; channel += 1) {
      const from = input[channel] ?? input[0];
      const to = output[channel];
      if (!from) {
        to.fill(0);
        continue;
      }
      for (let frame = 0; frame < to.length; frame += 1) {
        to[frame] = this.kernel.tick(from[frame], channel);
      }
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(PROCESSOR)}, PolarisProcessor);
`;

export interface PolarisEngine {
  /** Plays into `destination`, the bus. */
  attach: (destination: AudioNode) => Promise<boolean>;
  detach: () => void;
  /** The loop it plays, once rendered. */
  load: (buffer: AudioBuffer) => void;
  play: () => void;
  set: (id: PolarisParam, value: number) => void;
  stop: () => void;
}

export function createPolarisEngine(
  wasm: ArrayBuffer,
  initial: PolarisState
): PolarisEngine {
  let node: AudioWorkletNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let loop: AudioBuffer | null = null;
  const state = { ...initial };

  const stop = () => {
    source?.stop();
    source?.disconnect();
    source = null;
  };

  return {
    attach: async (destination) => {
      const ctx = destination.context;
      if (!(await loadWorklet(ctx, WORKLET))) {
        return false;
      }
      node = new AudioWorkletNode(ctx, PROCESSOR, {
        outputChannelCount: [2],
        parameterData: state,
        processorOptions: { wasm },
      });
      node.connect(destination);
      return true;
    },
    detach: () => {
      stop();
      node?.disconnect();
      node = null;
    },
    load: (buffer) => {
      loop = buffer;
    },
    play: () => {
      if (!(node && loop)) {
        return;
      }
      stop();
      source = node.context.createBufferSource();
      source.buffer = loop;
      source.loop = true;
      source.connect(node);
      source.start();
    },
    set: (id, value) => {
      state[id] = value;
      const param = node?.parameters.get(id);
      param?.setTargetAtTime(value, node?.context.currentTime ?? 0, RAMP);
    },
    stop,
  };
}
