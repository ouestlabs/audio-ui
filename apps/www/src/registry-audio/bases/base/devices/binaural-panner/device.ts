import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { BINAURAL_PANNER_KERNELS } from "@/registry-audio/bases/base/devices/binaural-panner/kernels";

/** The largest head, in metres: the worklet's delay line is made for it, so the head can change while it plays. */
export const LARGEST_HEAD_M = 0.12;

/**
 * A binaural panner as a device: a sound placed around a listener's head on
 * headphones, by the time and the level each ear hears it at, with no panel
 * and no audio in it.
 */
export const binauralPannerDevice = defineDevice({
  description:
    "Places a sound around the head, for headphones: the far ear hears it later and darker, shadowed by the head, as from a direction all around, and quieter the farther it is.",
  id: "audioui.binaural-panner",
  name: "Binaural Panner",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      anchor: 0,
      default: 0,
      format: (degrees: number) => `${Math.round(degrees)}°`,
      id: "azimuthDeg",
      label: "Direction",
      max: 180,
      min: -180,
      step: 1,
    },
    {
      default: 1,
      id: "distanceM",
      label: "Distance",
      max: 10,
      min: 0.5,
      scale: "log",
      step: 0.05,
      unit: "m",
    },
    {
      default: 8.75,
      id: "headCm",
      label: "Head",
      max: LARGEST_HEAD_M * 100,
      min: 5,
      step: 0.25,
      unit: "cm",
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

export type BinauralPannerState = DeviceState<
  typeof binauralPannerDevice.parameters
>;

/**
 * The numbers that go on the worklet for a state, the kernel's own: the
 * direction in degrees, 0 in front and 90 to the right, the distance and the
 * head's radius in metres, and the mix. Off, nothing is mixed in and the
 * kernel lets the sound through as it is.
 */
export function binauralPannerSettings(state: BinauralPannerState) {
  return {
    azimuth: state.azimuthDeg,
    distance: state.distanceM,
    headRadius: state.headCm / 100,
    mix: state.enabled ? state.mix / 100 : 0,
  };
}

/** The radius on the panel's top view of the nearest and the farthest distance: the head is the space inside. */
const NEAREST_RADIUS = 0.25;
const FARTHEST_RADIUS = 0.95;

/**
 * Where a state's sound sits on the panel's top view, from -1 to 1 each way:
 * in front is up and the right is right, the farther the farther out, the
 * distance on a log scale.
 */
export function binauralPoint(state: BinauralPannerState) {
  const angle = (state.azimuthDeg * Math.PI) / 180;
  const share = Math.log(state.distanceM / 0.5) / Math.log(20);
  const radius = NEAREST_RADIUS + (FARTHEST_RADIUS - NEAREST_RADIUS) * share;
  return { x: radius * Math.sin(angle), y: radius * Math.cos(angle) };
}

/** The direction in degrees and the distance in metres of a point on the panel's top view: `binauralPoint` the other way round. */
export function binauralPlace(point: { x: number; y: number }) {
  const share =
    (Math.hypot(point.x, point.y) - NEAREST_RADIUS) /
    (FARTHEST_RADIUS - NEAREST_RADIUS);
  return {
    azimuthDeg: (Math.atan2(point.x, point.y) * 180) / Math.PI,
    distanceM: 0.5 * 20 ** Math.min(1, Math.max(0, share)),
  };
}

/**
 * The source of the binaural panner's `AudioWorklet`, processor
 * `audioui-binaural-panner`: the binaural panner of `@audio/spatial-binaural`,
 * a sound folded to mono and placed by the time and the head's shadow at each
 * ear. Its parameters are the kernel's own; its delay line is made for the
 * largest head the first time it plays, so the head can change live.
 */
export const BINAURAL_PANNER_WORKLET = `${BINAURAL_PANNER_KERNELS}
const LARGEST_HEAD_M = ${LARGEST_HEAD_M};
const EMPTY = new Float32Array(0);

class AudioUiBinauralPanner extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Unwrapped: a turn across the back comes as the angle nearest the last, past 180.
      { name: "azimuth", defaultValue: 0, minValue: -1e6, maxValue: 1e6, automationRate: "k-rate" },
      { name: "distance", defaultValue: 1, minValue: 0.01, maxValue: 100, automationRate: "k-rate" },
      { name: "headRadius", defaultValue: 0.0875, minValue: 0.01, maxValue: LARGEST_HEAD_M, automationRate: "k-rate" },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.state = null;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(input && input.length > 0 && output && output.length > 1)) {
      return true;
    }
    if (!this.state) {
      // The kernel's line only grows: made once for the largest head, it never has to again.
      this.state = { azimuth: parameters.azimuth[0], fs: sampleRate, headRadius: LARGEST_HEAD_M, mix: 1 };
      binaural(EMPTY, EMPTY, this.state);
    }
    this.state.azimuth = parameters.azimuth[0];
    this.state.distance = parameters.distance[0];
    this.state.headRadius = parameters.headRadius[0];
    this.state.mix = parameters.mix[0];
    output[0].set(input[0]);
    output[1].set(input[1] ?? input[0]);
    binaural(output[0], output[1], this.state);
    return true;
  }
}
registerProcessor("audioui-binaural-panner", AudioUiBinauralPanner);
`;
