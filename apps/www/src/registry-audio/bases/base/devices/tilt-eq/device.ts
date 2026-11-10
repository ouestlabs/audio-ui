import { highshelf, lowshelf, magnitude } from "@audio/biquad";
import { formatHz, SAMPLE_RATE } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { TILT_EQ_KERNELS } from "@/registry-audio/bases/base/devices/tilt-eq/kernels";

/** The width of the tilt's two shelves, as `@audio/eq-tilt` has them: gentler than a shelf's usual slope. */
const SHELF_Q = 0.5;

/**
 * A tilt EQ as a device: one knob that tilts the tone around a pivot, the
 * highs rising as the lows fall or the other way round, and an output level,
 * with no panel and no audio in it.
 */
export const tiltEqDevice = defineDevice({
  description:
    "Tilts the tone around a pivot with one knob: turned up, the highs rise and the lows fall by as much, turned down the other way round, then an output level.",
  id: "audioui.tilt-eq",
  name: "Tilt EQ",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      anchor: 0,
      default: 0,
      id: "tiltDb",
      label: "Tilt",
      max: 12,
      min: -12,
      step: 0.1,
      unit: "dB",
    },
    {
      default: 1000,
      format: formatHz,
      id: "pivotHz",
      label: "Pivot",
      max: 10_000,
      min: 100,
      scale: "log",
      step: 1,
    },
    {
      anchor: 0,
      default: 0,
      id: "outputDb",
      label: "Output",
      max: 12,
      min: -12,
      step: 0.1,
      unit: "dB",
    },
  ],
});

export type TiltEqState = DeviceState<typeof tiltEqDevice.parameters>;

/**
 * The numbers that go on the worklet for a state. The kernel's gain raises the
 * lows, so it takes the tilt the other way round. Off, the tilt is flat and the
 * output at unity.
 */
export function tiltEqSettings(state: TiltEqState) {
  return {
    gain: state.enabled ? -state.tiltDb : 0,
    output: state.enabled ? 10 ** (state.outputDb / 20) : 1,
    pivot: state.pivotHz,
  };
}

/**
 * The curve a state plays: the gain in dB at each frequency, the tilt's two
 * shelves from `@audio/biquad` as the kernel makes them, and the output. Flat
 * when it is off.
 */
export function tiltEqCurve(state: TiltEqState) {
  if (!state.enabled) {
    return () => 0;
  }
  const { gain, pivot } = tiltEqSettings(state);
  const low = lowshelf(pivot, SHELF_Q, SAMPLE_RATE, gain);
  const high = highshelf(pivot, SHELF_Q, SAMPLE_RATE, -gain);
  return (frequency: number) =>
    20 *
      Math.log10(
        magnitude(low, frequency, SAMPLE_RATE) *
          magnitude(high, frequency, SAMPLE_RATE)
      ) +
    state.outputDb;
}

/**
 * The source of the tilt's `AudioWorklet`, processor `audioui-tilt-eq`: the
 * tilt of `@audio/eq-tilt`, a low shelf and a high shelf of `@audio/biquad` at
 * the pivot with opposite gains, per channel. Its parameters are the kernel's
 * gain (which raises the lows) and the pivot; a change makes new coefficients
 * and keeps the filters' state, so a turn of the knob does not click.
 */
export const TILT_EQ_WORKLET = `${TILT_EQ_KERNELS}
class AudioUiTiltEq extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "gain", defaultValue: 0, minValue: -24, maxValue: 24, automationRate: "k-rate" },
      { name: "pivot", defaultValue: 1000, minValue: 20, maxValue: 20000, automationRate: "k-rate" },
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
      state.gain = parameters.gain[0];
      state.pivot = parameters.pivot[0];
      tilt(data, state);
    }
    return true;
  }
}
registerProcessor("audioui-tilt-eq", AudioUiTiltEq);
`;
