import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/**
 * A compressor as a device: its parameters and what they mean, with no panel
 * and no audio in it. A panel draws its state, an engine plays it, an agent
 * drives it through `deviceTools(compressorDevice)`.
 */
/** How far ahead the node looks at the signal, in seconds: its latency, measured in Chrome at 44.1 and 48 kHz. The dry path is delayed by it so a parallel mix does not comb. */
export const COMPRESSOR_LOOKAHEAD_SECONDS = 0.006;

export const compressorDevice = defineDevice({
  description:
    "Brings loud parts down: above the threshold the level rises by one decibel for every ratio decibels in, with a soft knee, an attack and a release, make-up gain and a dry and compressed mix. With the key on, the level it follows is the one of another signal, the sidechain: a kick can duck a pad.",
  id: "audioui.compressor",
  // The dry path waits for the node too, so the delay is the same on or off.
  latency: () => COMPRESSOR_LOOKAHEAD_SECONDS,
  name: "Compressor",
  sidechain: true,
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -18,
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
      default: 5,
      id: "attackMs",
      label: "Attack",
      max: 100,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 80,
      id: "releaseMs",
      label: "Release",
      max: 1000,
      min: 10,
      scale: "log",
      step: 1,
      unit: "ms",
    },
    {
      default: 6,
      id: "kneeDb",
      label: "Knee",
      max: 40,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: true,
      id: "autoMakeup",
      kind: "toggle",
      label: "Auto make-up",
    },
    {
      default: 0,
      id: "makeupDb",
      label: "Make-up",
      max: 24,
      min: 0,
      step: 0.5,
      unit: "dB",
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
    { default: false, id: "external", kind: "toggle", label: "Key" },
  ],
});

export type CompressorState = DeviceState<typeof compressorDevice.parameters>;

/** A level well under any threshold, where the node only adds its make-up. */
const QUIET_DB = -120;

/**
 * The make-up gain the browser's compressor node adds on its own, which it
 * cannot be told not to: it grows with the threshold and the ratio.
 */
export function nodeMakeupDb(
  state: Pick<CompressorState, "kneeDb" | "ratio" | "thresholdDb">
) {
  const curve = webAudioCompressorOutput({
    kneeDb: state.kneeDb,
    ratio: state.ratio,
    thresholdDb: state.thresholdDb,
  });
  return curve(QUIET_DB) - QUIET_DB;
}

/**
 * The numbers that go on the nodes for a state, as plain values. Pure, so
 * what an engine sets can be read and tested without an AudioContext.
 *
 * `trimDb` is what the engine adds after the node. The node's own make-up
 * cannot be turned off, so with `autoMakeup` off it is taken back out and
 * `makeupDb` put in its place, and with it on the node's is kept.
 */
export function compressorSettings(state: CompressorState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    // With the key on, the compressed signal goes through the keyed path (the worklet's gain) and not the node.
    keyedWet: state.external ? mix : 0,
    // The keyed path has no node to add make-up: the node's own is added by hand, or the knob's.
    keyedTrimDb: state.autoMakeup ? nodeMakeupDb(state) : state.makeupDb,
    nativeWet: state.external ? 0 : mix,
    attack: state.attackMs / 1000,
    dry: 1 - mix,
    external: state.external,
    knee: state.kneeDb,
    ratio: state.ratio,
    release: state.releaseMs / 1000,
    threshold: state.thresholdDb,
    trimDb: state.autoMakeup ? 0 : state.makeupDb - nodeMakeupDb(state),
    wet: mix,
  };
}

/**
 * The curve a state plays: the output level in dB for an input level in dB,
 * through the node, its trim and the dry and compressed mix.
 *
 * It is the static curve, the level once the gain has settled. A real
 * detector follows a signal with an attack and a release, so what you hear
 * sits above it by a little: measured in Chrome with a 440 Hz sine, about
 * 0.5 dB at the defaults and up to 1.3 dB with a slow attack and a short
 * release. Below the threshold it is exact.
 */
export function compressorCurve(state: CompressorState) {
  const { dry, trimDb, wet } = compressorSettings(state);
  const node = webAudioCompressorOutput({
    kneeDb: state.kneeDb,
    ratio: state.ratio,
    thresholdDb: state.thresholdDb,
  });
  return (inputDb: number) => {
    const wetDb = node(inputDb) + trimDb;
    const amplitude = dry * 10 ** (inputDb / 20) + wet * 10 ** (wetDb / 20);
    return amplitude > 0
      ? 20 * Math.log10(amplitude)
      : Number.NEGATIVE_INFINITY;
  };
}

/**
 * The processor of the key, as the source of an `AudioWorklet`. It reads the
 * key and writes the gain to apply, one value per sample: the level of the key
 * (a peak follower: instant up, 10 ms down, so a low note does not ripple the
 * reduction) in dB goes through the same curve as the node's (a soft knee around the
 * threshold, a slope of 1/ratio over it), and the reduction is smoothed with
 * the attack going down and the release coming back. It posts the reduction
 * about every 10 ms, for a meter. The engine loads it from a blob, so there is
 * no file to serve.
 */
export const COMPRESSOR_KEY_WORKLET = `
class AudioUiCompressorKey extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -18, minValue: -100, maxValue: 0, automationRate: "k-rate" },
      { name: "ratio", defaultValue: 4, minValue: 1, maxValue: 20, automationRate: "k-rate" },
      { name: "knee", defaultValue: 6, minValue: 0, maxValue: 40, automationRate: "k-rate" },
      { name: "attack", defaultValue: 0.005, minValue: 0.00005, maxValue: 1, automationRate: "k-rate" },
      { name: "release", defaultValue: 0.08, minValue: 0.001, maxValue: 10, automationRate: "k-rate" }
    ];
  }
  constructor() {
    super();
    this.reduction = 0;
    this.level = 0;
    this.sent = 0;
  }
  process(inputs, outputs, parameters) {
    const key = inputs[0];
    const out = outputs[0][0];
    if (!out) return true;
    const threshold = parameters.threshold[0];
    const ratio = parameters.ratio[0];
    const knee = parameters.knee[0];
    const attack = 1 - Math.exp(-1 / (parameters.attack[0] * sampleRate));
    const release = 1 - Math.exp(-1 / (parameters.release[0] * sampleRate));
    const fall = Math.exp(-1 / (0.01 * sampleRate));
    for (let n = 0; n < out.length; n += 1) {
      let peak = 0;
      for (let c = 0; c < key.length; c += 1) {
        const v = Math.abs(key[c][n]);
        if (v > peak) peak = v;
      }
      this.level = peak > this.level ? peak : this.level * fall;
      const level = 20 * Math.log10(this.level + 1e-9);
      const over = level - threshold;
      let target = 0;
      if (2 * over > knee) target = (1 / ratio - 1) * over;
      else if (2 * over > -knee) target = (1 / ratio - 1) * ((over + knee / 2) ** 2) / (2 * knee);
      this.reduction += (target - this.reduction) * (target < this.reduction ? attack : release);
      out[n] = 10 ** (this.reduction / 20);
    }
    this.sent += out.length;
    if (this.sent >= sampleRate / 100) {
      this.sent = 0;
      this.port.postMessage(this.reduction);
    }
    return true;
  }
}
registerProcessor("audioui-compressor-key", AudioUiCompressorKey);
`;
