import { compressor } from "@audio/dynamics-compressor/audio";
import { fet } from "@audio/dynamics-fet/audio";
import { opto } from "@audio/dynamics-opto/audio";
import { varimu } from "@audio/dynamics-varimu/audio";
import { vca } from "@audio/dynamics-vca/audio";
import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { COMPRESSOR_KERNELS } from "@/components/audio-ui/devices/compressor/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";

/**
 * A compressor as a device: its parameters and what they mean, with no panel
 * and no audio in it. A panel draws its state, an engine plays it, an agent
 * drives it through `deviceTools(compressorDevice)`.
 */
/** How far ahead the node looks at the signal, in seconds: its latency, measured in Chrome at 44.1 and 48 kHz. The dry path is delayed by it so a parallel mix does not comb. */
export const COMPRESSOR_LOOKAHEAD_SECONDS = 0.006;

export const compressorDevice = defineDevice({
  description:
    "Brings loud parts down: above the threshold the level rises by one decibel for every ratio decibels in, with a soft knee, an attack and a release, make-up gain and a dry and compressed mix. Its model is the clean compressor of the browser, the only one with auto make-up and a sidechain (with the sidechain on, the level it follows is the one of another signal: a kick can duck a pad); a smooth one, whose gain reduction is smoothed in decibels so its attack and release hold at any depth; a VCA, clean and near hard-kneed; a FET, very fast; an opto, which follows the level's RMS and releases slower the longer it has been reducing, with no release of its own; or a vari-mu, which follows its own output, its ratio rising as it is pushed, with no ratio of its own.",
  id: "audioui.compressor",
  // The dry path waits for the node too, so the delay is the same on or off.
  latency: () => COMPRESSOR_LOOKAHEAD_SECONDS,
  name: "Compressor",
  sidechain: true,
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "clean",
      id: "model",
      kind: "choice",
      label: "Model",
      options: [
        { label: "Clean", value: "clean" },
        { label: "Smooth", value: "smooth" },
        { label: "VCA", value: "vca" },
        { label: "FET", value: "fet" },
        { label: "Opto", value: "opto" },
        { label: "Vari-Mu", value: "varimu" },
      ],
    },
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
    { default: false, id: "external", kind: "toggle", label: "Sidechain" },
  ],
});

export type CompressorState = DeviceState<typeof compressorDevice.parameters>;
export type CompressorModel = CompressorState["model"];

/**
 * The models other than the clean one, each the processor of an audio.js
 * package's manifest (`@audio/dynamics-*`), by the value that picks it: its
 * parameters, which of them make it again (flagged `restart`) and how long
 * its state lasts once the sound stops.
 */
export const COMPRESSOR_MODELS = {
  fet,
  opto,
  smooth: compressor,
  varimu,
  vca,
} as const;

/** Each knob a model can take, and the parameter of a model's manifest it sets. */
const MODEL_PARAMETERS = {
  attackMs: "attack",
  kneeDb: "knee",
  ratio: "ratio",
  releaseMs: "release",
  thresholdDb: "threshold",
} as const;

/** The controls a model does not use: the clean one's own for the others, and the knobs its manifest has no parameter for. */
export function compressorUnused(model: CompressorModel) {
  if (model === "clean") {
    return [];
  }
  const { params } = COMPRESSOR_MODELS[model];
  return [
    "autoMakeup",
    "external",
    ...Object.entries(MODEL_PARAMETERS).flatMap(([id, name]) =>
      name in params ? [] : [id]
    ),
  ] as (keyof CompressorState)[];
}

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
  const clean = state.model === "clean";
  // Only the clean model listens to a key.
  const external = clean && state.external;
  return {
    // With the key on, the compressed signal goes through the keyed path (the worklet's gain) and not the node.
    keyedWet: external ? mix : 0,
    // The keyed path has no node to add make-up: the node's own is added by hand, or the knob's.
    keyedTrimDb: state.autoMakeup ? nodeMakeupDb(state) : state.makeupDb,
    model: state.model,
    /** What a model other than the clean one is made with, in its manifest's units. */
    modelParams: {
      attack: state.attackMs,
      knee: state.kneeDb,
      ratio: state.ratio,
      release: state.releaseMs,
      threshold: state.thresholdDb,
    },
    // A model has no make-up of its own: the knob's goes on after it.
    modelTrimDb: state.makeupDb,
    modelWet: clean ? 0 : mix,
    nativeWet: clean && !external ? mix : 0,
    attack: state.attackMs / 1000,
    dry: 1 - mix,
    external,
    knee: state.kneeDb,
    ratio: state.ratio,
    release: state.releaseMs / 1000,
    threshold: state.thresholdDb,
    trimDb: state.autoMakeup ? 0 : state.makeupDb - nodeMakeupDb(state),
    wet: mix,
  };
}

/** The levels a model's curve is measured at, in dB, a decibel apart: past both ends of the panel's plot. */
const CURVE_FROM_DB = -72;
const CURVE_TO_DB = 12;
/** The rate a model runs at to be measured: a steady level settles the same at any rate, and this one is cheap. */
const CURVE_RATE = 1000;
const BLOCK = 128;

/** The values a model is made and played with: the knobs for the parameters it has, its manifest's defaults for the rest, and no make-up, which the engine adds after it. */
function modelValues(
  model: keyof typeof COMPRESSOR_MODELS,
  params: Record<string, number>
) {
  return Object.fromEntries(
    Object.entries(COMPRESSOR_MODELS[model].params).map(([name, param]) => [
      name,
      Float32Array.of(
        name === "makeup" ? 0 : (params[name] ?? (param.default as number))
      ),
    ])
  );
}

/**
 * The level a model puts out for each level going in, in dB, as it plays it:
 * the model's own processor run on a steady level until its gain has settled,
 * ten of its attacks, one level a decibel apart, read in between in a line.
 */
export function modelCurve(
  model: keyof typeof COMPRESSOR_MODELS,
  params: CompressorSettings["modelParams"]
) {
  const values = modelValues(model, params);
  const frames = Math.max(
    4 * BLOCK,
    Math.ceil(((10 * params.attack) / 1000) * CURVE_RATE)
  );
  const block = new Float32Array(BLOCK);
  const out = new Float32Array(BLOCK);
  const levels: number[] = [];
  for (let db = CURVE_FROM_DB; db <= CURVE_TO_DB; db += 1) {
    const run = COMPRESSOR_MODELS[model]({
      currentTime: 0,
      maxBlockSize: BLOCK,
      maxChannels: 1,
      params: values,
      sampleRate: CURVE_RATE,
    });
    block.fill(10 ** (db / 20));
    for (let done = 0; done < frames; done += BLOCK) {
      run([[block]], [[out]], values);
    }
    levels.push(20 * Math.log10(Math.abs(out[BLOCK - 1] ?? 0) + 1e-30));
  }
  return (inputDb: number) => {
    const at = Math.min(
      Math.max(inputDb - CURVE_FROM_DB, 0),
      levels.length - 1
    );
    const below = Math.min(Math.floor(at), levels.length - 2);
    const share = at - below;
    const from = levels[below] ?? 0;
    const to = levels[below + 1] ?? from;
    // The gain between two levels, read in a line, so the curve holds past both ends.
    return inputDb + from - (below + CURVE_FROM_DB) + share * (to - from - 1);
  };
}

type CompressorSettings = ReturnType<typeof compressorSettings>;

/**
 * The curve a state plays: the output level in dB for an input level in dB,
 * through the node and its trim, or the model and the make-up, and the dry
 * and compressed mix.
 *
 * It is the static curve, the level once the gain has settled. A real
 * detector follows a signal with an attack and a release, so what you hear
 * sits above it by a little: measured in Chrome with a 440 Hz sine through
 * the clean model, about 0.5 dB at the defaults and up to 1.3 dB with a slow
 * attack and a short release. A model sits above it by what its detector
 * does: under 0.1 dB for the smooth one, about 2 dB for the opto and the
 * vari-mu, which follow the RMS level, and about 5 dB for the VCA and the
 * FET, which follow the waveform itself. Below the threshold it is exact.
 */
export function compressorCurve(state: CompressorState) {
  const { dry, modelParams, modelTrimDb, trimDb, wet } =
    compressorSettings(state);
  let wetOf: (inputDb: number) => number;
  if (state.model === "clean") {
    const node = webAudioCompressorOutput({
      kneeDb: state.kneeDb,
      ratio: state.ratio,
      thresholdDb: state.thresholdDb,
    });
    wetOf = (inputDb) => node(inputDb) + trimDb;
  } else {
    const model = modelCurve(state.model, modelParams);
    wetOf = (inputDb) => model(inputDb) + modelTrimDb;
  }
  return (inputDb: number) => {
    const amplitude =
      dry * 10 ** (inputDb / 20) + wet * 10 ** (wetOf(inputDb) / 20);
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

/**
 * The source of the models' `AudioWorklet`, processor
 * `audioui-compressor-models`: each model's audio.js manifest, played by
 * `manifestWorklet`, the model sent by message. A model has no make-up of its
 * own: the engine adds the knob's after it.
 */
export const COMPRESSOR_MODELS_WORKLET = manifestWorklet({
  kernels: COMPRESSOR_KERNELS,
  models: {
    fet: "fet",
    opto: "opto",
    smooth: "compressor",
    varimu: "varimu",
    vca: "vca",
  },
  processor: "audioui-compressor-models",
});