import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { EXCITER_KERNELS } from "@/components/audio-ui/devices/exciter/kernels";

/** The damping of the kernel's high-pass, a Q of 2. */
const DAMPING = 0.5;

/**
 * An exciter as a device: the highs above a frequency, saturated into new
 * harmonics and added to the sound, with no panel and no audio in it.
 */
export const exciterDevice = defineDevice({
  description:
    "Adds presence and air: the highs above a frequency go through a soft saturation that makes new harmonics above them, added to the sound as an amount.",
  id: "audioui.exciter",
  name: "Exciter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 3000,
      format: formatHz,
      id: "frequencyHz",
      label: "Frequency",
      max: 8000,
      min: 500,
      scale: "log",
      step: 1,
    },
    {
      default: 50,
      id: "drive",
      label: "Drive",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 50,
      id: "amount",
      label: "Amount",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type ExciterState = DeviceState<typeof exciterDevice.parameters>;

/** The numbers that go on the worklet for a state, the kernel's own. Off, nothing is added. */
export function exciterSettings(state: ExciterState) {
  return {
    amount: state.enabled ? state.amount / 100 : 0,
    drive: state.drive / 100,
    fc: state.frequencyHz,
  };
}

/**
 * The band the exciter makes its harmonics from, in dB at each frequency: the
 * kernel's high-pass, a trapezoidal state-variable filter, its analog
 * s² / (s² + s / Q + 1) read through the bilinear map at the rate it runs.
 */
export function exciterBand(state: ExciterState, sampleRate = 48_000) {
  const at = Math.tan(
    (Math.PI * Math.min(state.frequencyHz, 0.49 * sampleRate)) / sampleRate
  );
  return (hz: number) => {
    const omega =
      Math.tan((Math.PI * Math.min(hz, 0.49 * sampleRate)) / sampleRate) / at;
    const real = 1 - omega * omega;
    const imaginary = DAMPING * omega;
    const magnitude = (omega * omega) / Math.hypot(real, imaginary);
    return 20 * Math.log10(Math.max(1e-9, magnitude));
  };
}

/**
 * The source of the exciter's `AudioWorklet`, processor `audioui-exciter`: the
 * exciter of `@audio/effect-exciter`, per channel, the sound with its new
 * harmonics. Its parameters are the frequency, the drive and the amount.
 */
export const EXCITER_WORKLET = `${EXCITER_KERNELS}
class AudioUiExciter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "fc", defaultValue: 3000, minValue: 20, maxValue: 20000, automationRate: "k-rate" },
      { name: "drive", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "amount", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.states = [];
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(input && input.length > 0 && output)) {
      return true;
    }
    for (let channel = 0; channel < output.length; channel += 1) {
      const data = output[channel];
      data.set(input[channel] ?? input[0]);
      this.states[channel] ??= { fs: sampleRate };
      const state = this.states[channel];
      state.fc = parameters.fc[0];
      state.drive = parameters.drive[0];
      state.amount = parameters.amount[0];
      exciter(data, state);
    }
    return true;
  }
}
registerProcessor("audioui-exciter", AudioUiExciter);
`;