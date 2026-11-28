import {
  contractParams,
  type DeviceState,
  defineDevice,
} from "@/engine/device";
import { compressorGain } from "@/engine/dsp";
import { DUCKER_KERNELS } from "@/engine/kernels";
import { manifestWorklet } from "@/registry/lib/devices/manifest-worklet";

/**
 * A ducker as a device: the ducker of `@audio/dynamics-ducker`, its
 * parameters and the gain it takes off for a level of the key, with no panel
 * and no audio in it. The key is another signal, connected to the engine's
 * `sidechain`: a voice ducks the music, a kick ducks a pad.
 */
export const duckerDevice = defineDevice({
  description:
    "Turns a sound down while another one plays: the key, connected to the sidechain, a voice over music or a kick under a pad. Above the threshold, each decibel of the key takes the ratio's share of a decibel off the sound, through a soft knee, never more than the range. The attack and the release say how fast it ducks and comes back. With no key, it follows the sound itself.",
  id: "audioui.ducker",
  name: "Ducker",
  sidechain: true,
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -30,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 4,
      format: (ratio: number) => `${ratio.toFixed(1)}:1`,
      id: "ratio",
      label: "Ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: 6,
      id: "kneeDb",
      label: "Knee",
      max: 24,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 24,
      id: "rangeDb",
      label: "Range",
      max: 90,
      min: 0,
      step: 1,
      unit: "dB",
    },
    {
      default: 20,
      id: "attackMs",
      label: "Attack",
      max: 200,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 300,
      id: "releaseMs",
      label: "Release",
      max: 2000,
      min: 1,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type DuckerState = DeviceState<typeof duckerDevice.parameters>;

/** The gain a state puts on the sound, in dB, for a level of the key in dB, once it has settled: the package's own compression curve, held within the range. */
export function duckerCurve(state: DuckerState) {
  if (!state.enabled) {
    return () => 0;
  }
  const { kneeDb, rangeDb, ratio, thresholdDb } = state;
  return (keyDb: number) =>
    Math.max(-rangeDb, compressorGain(keyDb, thresholdDb, ratio, kneeDb));
}

/** How long the ducker takes to come in or to go round the sound when it is turned on or off, in seconds. */
const SWITCH_SECONDS = 0.01;

/**
 * The ducker as one audio.js processor, its parameters the device's own
 * (`contractParams`): what the worklet plays and what a plugin host would read.
 * It runs the processor of `@audio/dynamics-ducker` on the sound and the key,
 * gives it the range as a cut, and goes round it while it is off, in a line.
 */
const DUCKER_PROCESSOR = `
const duckerProcessor = (ctx) => {
  const values = {};
  for (const name in ducker.params) {
    values[name] = new Float32Array(1);
  }
  const processed = [];
  for (let channel = 0; channel < ctx.maxChannels; channel += 1) {
    processed.push(new Float32Array(ctx.maxBlockSize));
  }
  const outputs = [processed];
  const read = (params) => {
    values.threshold[0] = params.thresholdDb[0];
    values.ratio[0] = params.ratio[0];
    values.knee[0] = params.kneeDb[0];
    values.range[0] = -params.rangeDb[0];
    values.attack[0] = params.attackMs[0];
    values.release[0] = params.releaseMs[0];
  };
  read(ctx.params);
  const run = ducker({ ...ctx, params: values });
  const step = 1 / (${SWITCH_SECONDS} * ctx.sampleRate);
  let amount = ctx.params.enabled ? 1 : 0;
  return (inputs, [out], params) => {
    const main = inputs[0];
    read(params);
    run(inputs, outputs, values);
    const target = params.enabled ? 1 : 0;
    let next = amount;
    for (let channel = 0; channel < main.length; channel += 1) {
      const dry = main[channel];
      const wet = processed[channel];
      next = amount;
      for (let frame = 0; frame < dry.length; frame += 1) {
        next = target > next ? Math.min(target, next + step) : Math.max(target, next - step);
        out[channel][frame] = dry[frame] + next * (wet[frame] - dry[frame]);
      }
    }
    amount = next;
  };
};
duckerProcessor.params = ${JSON.stringify(contractParams(duckerDevice))};
duckerProcessor.channels = ducker.channels;
duckerProcessor.tail = ducker.tail;
`;

/**
 * The source of the ducker's `AudioWorklet`, processor `audioui-ducker`: the
 * device's processor, played by `manifestWorklet`, the sound on its first input
 * and the key on its second. Its parameters are the device's, by id, a toggle
 * as 0 or 1, and every one changes as it plays.
 */
export const DUCKER_WORKLET = manifestWorklet({
  kernels: `${DUCKER_KERNELS}\n${DUCKER_PROCESSOR}`,
  models: { ducker: "duckerProcessor" },
  processor: "audioui-ducker",
});
