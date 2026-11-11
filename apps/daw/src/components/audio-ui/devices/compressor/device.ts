import { compressor } from "@audio/dynamics-compressor/audio";
import { fet } from "@audio/dynamics-fet/audio";
import { opto } from "@audio/dynamics-opto/audio";
import { varimu } from "@audio/dynamics-varimu/audio";
import { vca } from "@audio/dynamics-vca/audio";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { COMPRESSOR_KERNELS } from "@/components/audio-ui/devices/compressor/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";

/**
 * A compressor as a device: its parameters and what they mean, with no panel
 * and no audio in it. A panel draws its state, an engine plays it, an agent
 * drives it through `deviceTools(compressorDevice)`. Its models are the
 * compressors of audio.js.
 */
export const compressorDevice = defineDevice({
  description:
    "Brings loud parts down: above the threshold the level rises by one decibel for every ratio decibels in, with a soft knee, an attack and a release, make-up gain and a dry and compressed mix. Its model is a smooth one, whose gain reduction is smoothed in decibels so its attack and release hold at any depth; a VCA, clean and near hard-kneed; a FET, very fast; an opto, which follows the level's RMS and releases slower the longer it has been reducing, with no release of its own; or a vari-mu, which follows its own output, its ratio rising as it is pushed, with no ratio of its own.",
  id: "audioui.compressor",
  name: "Compressor",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "smooth",
      id: "model",
      kind: "choice",
      label: "Model",
      options: [
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
  ],
});

export type CompressorState = DeviceState<typeof compressorDevice.parameters>;
export type CompressorModel = CompressorState["model"];

/**
 * The models, each the processor of an audio.js
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

/** The controls a model does not use: the knobs its manifest has no parameter for. */
export function compressorUnused(model: CompressorModel) {
  const { params } = COMPRESSOR_MODELS[model];
  return Object.entries(MODEL_PARAMETERS).flatMap(([id, name]) =>
    name in params ? [] : [id]
  ) as (keyof CompressorState)[];
}

/**
 * The numbers that go on the nodes for a state, as plain values. Pure, so
 * what an engine sets can be read and tested without an AudioContext.
 */
export function compressorSettings(state: CompressorState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    dry: 1 - mix,
    /** What the model is made with, in its manifest's units. */
    modelParams: {
      attack: state.attackMs,
      knee: state.kneeDb,
      ratio: state.ratio,
      release: state.releaseMs,
      threshold: state.thresholdDb,
    },
    // A model has no make-up of its own: the knob's goes on after it.
    modelTrimDb: state.makeupDb,
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
 * through the model and the make-up, and the dry and compressed mix.
 *
 * It is the static curve, the level once the gain has settled. A real
 * detector follows a signal with an attack and a release, so what you hear
 * sits above it by what the model's detector does: under 0.1 dB for the
 * smooth one, about 2 dB for the opto and the vari-mu, which follow the RMS
 * level, and about 5 dB for the VCA and the FET, which follow the waveform
 * itself. Below the threshold it is exact.
 */
export function compressorCurve(state: CompressorState) {
  const { dry, modelParams, modelTrimDb, wet } = compressorSettings(state);
  const model = modelCurve(state.model, modelParams);
  return (inputDb: number) => {
    const amplitude =
      dry * 10 ** (inputDb / 20) +
      wet * 10 ** ((model(inputDb) + modelTrimDb) / 20);
    return amplitude > 0
      ? 20 * Math.log10(amplitude)
      : Number.NEGATIVE_INFINITY;
  };
}

/**
 * The source of the compressor's `AudioWorklet`, processor
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