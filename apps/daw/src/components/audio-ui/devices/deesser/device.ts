import { deesser } from "@audio/dynamics-deesser/audio";
import { biquadResponse, formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { DEESSER_KERNELS } from "@/components/audio-ui/devices/deesser/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";

/** The Q of each biquad of the crossover: two of them in a row are a Linkwitz-Riley filter, whose low and high halves add back to a flat response. */
export const CROSSOVER_Q = Math.SQRT1_2;
/** How fast the detector takes the gain down and lets it back, in seconds: fast enough to catch a sibilant, slow enough not to ripple. */
export const ATTACK_SECONDS = 0.0005;
export const RELEASE_SECONDS = 0.06;
/** The soft knee of the detector, in dB. */
export const KNEE_DB = 3;

/**
 * A de-esser as a device: it takes the highs above a frequency down when they
 * get loud, so the sibilants of a voice sit with the rest, with no panel and no
 * audio in it. Its clean model splits the signal in two at the frequency, the
 * highs go through a detector that takes them down over a threshold, and the
 * two halves are added back. Its other models are the de-esser of
 * `@audio/dynamics-deesser`, which tells an s by the highs rising over the
 * voice's body, whatever the level, and takes down the highs, a band or the
 * whole sound.
 */
export const deesserDevice = defineDevice({
  description:
    "Tames the sharp s and t of a voice: when the highs above a frequency get loud they are taken down by the ratio, never by more than the range. Its clean model, the only one with Listen (only the highs, to find the frequency), takes them down when they go over the threshold. The split, band and wide band models tell an s by how far the highs rise over the voice's body, whatever the level, and take down the highs above the frequency, a band around it as wide as its Q, or the whole sound while the s lasts.",
  id: "audioui.deesser",
  // The models other than the clean one read the sound ahead of what they cut: 5 ms.
  latency: (state, sampleRate) =>
    state.enabled && state.model !== "clean"
      ? deesser.latency({
          params: { lookahead: Float32Array.of(5) },
          sampleRate,
        }) / sampleRate
      : 0,
  name: "De-esser",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "clean",
      id: "model",
      kind: "choice",
      label: "Model",
      options: [
        { label: "Clean", value: "clean" },
        { label: "Split", value: "split" },
        { label: "Band", value: "band" },
        { label: "Wide band", value: "broadband" },
      ],
    },
    {
      default: 6500,
      format: formatHz,
      id: "frequencyHz",
      label: "Frequency",
      max: 12_000,
      min: 2000,
      scale: "log",
      step: 10,
    },
    {
      default: 1.4,
      id: "q",
      label: "Q",
      max: 10,
      min: 0.3,
      scale: "log",
      step: 0.01,
    },
    {
      default: -32,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      id: "overBodyDb",
      label: "Over body",
      max: 24,
      min: -12,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 6,
      format: (ratio: number) => `${ratio.toFixed(1)}:1`,
      id: "ratio",
      label: "Ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: 12,
      id: "rangeDb",
      label: "Range",
      max: 24,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    { default: false, id: "listen", kind: "toggle", label: "Listen" },
  ],
});

export type DeesserState = DeviceState<typeof deesserDevice.parameters>;

/** The controls a model does not use: the others' own for the clean one; the threshold and Listen for the others, and the Q but for the band. */
export function deesserUnused(model: DeesserState["model"]) {
  if (model === "clean") {
    return ["q", "overBodyDb"] as const;
  }
  return model === "band"
    ? (["thresholdDb", "listen"] as const)
    : (["thresholdDb", "listen", "q"] as const);
}

/** The numbers that go on the nodes for a state. Off, the range is nothing and the signal passes through the crossover unchanged. */
export function deesserSettings(state: DeesserState) {
  const clean = state.model === "clean";
  return {
    model: state.model,
    /** What the other models are made with, in the manifest's units: the mode by its index, the range as a cut. */
    modelParams: {
      fc: state.frequencyHz,
      mode:
        state.model === "clean"
          ? 0
          : deesser.params.mode.values.indexOf(state.model),
      Q: state.q,
      range: -state.rangeDb,
      ratio: state.ratio,
      split: state.frequencyHz,
      threshold: state.overBodyDb,
    },
    modelWet: state.enabled && !clean ? 1 : 0,
    attack: ATTACK_SECONDS,
    frequency: state.frequencyHz,
    // The least gain the highs can have: the range, as a gain.
    floor: state.enabled ? 10 ** (-state.rangeDb / 20) : 1,
    knee: KNEE_DB,
    // Listen plays the highs alone: the lows are turned down.
    lowGain: clean && state.listen ? 0 : 1,
    ratio: state.ratio,
    release: RELEASE_SECONDS,
    threshold: state.thresholdDb,
  };
}

/**
 * The table of a `WaveShaperNode` that turns the gain the detector writes (0 to
 * 1) into the gain the highs get: the same, but never under the floor.
 * Rebuilt only when the range changes.
 */
export function deesserTable(floor: number): Float32Array<ArrayBuffer> {
  const samples = 2048;
  const table = new Float32Array(new ArrayBuffer(samples * 4));
  for (let index = 0; index < samples; index += 1) {
    const gain = (index * 2) / (samples - 1) - 1;
    table[index] = Math.max(floor, gain);
  }
  return table;
}

/**
 * What the device does at each frequency when the highs are taken down as far
 * as the range allows, in dB: what the panel draws. The cut takes its share
 * of the sound at each frequency down to the floor: the highs of the
 * crossover (which the split model's linear-phase split matches at the
 * frequency, both halves 6 dB down), a band as wide as the Q, or all of it.
 * The halves are in phase, so their amplitudes add.
 */
export function deesserResponse(state: DeesserState) {
  const floor = state.enabled ? 10 ** (-state.rangeDb / 20) : 1;
  const share = cutShare(state);
  return (hz: number) => 20 * Math.log10(1 - (1 - floor) * share(hz));
}

/** How much of the sound at a frequency a model's cut takes, from 0 to 1. */
function cutShare(state: DeesserState): (hz: number) => number {
  if (state.model === "broadband") {
    return () => 1;
  }
  if (state.model === "band") {
    const band = biquadResponse({
      frequency: state.frequencyHz,
      q: state.q,
      type: "bandpass",
    });
    return (hz) => 10 ** (band(hz) / 20);
  }
  const high = biquadResponse({
    frequency: state.frequencyHz,
    q: CROSSOVER_Q,
    type: "lowcut",
  });
  // Two biquads in a row square the magnitude, so the dB double.
  return (hz) => 10 ** ((2 * high(hz)) / 20);
}

/**
 * The source of the other models' `AudioWorklet`, processor
 * `audioui-deesser`: the manifest of `@audio/dynamics-deesser`, played by
 * `manifestWorklet`, its mode a parameter. Every parameter makes it again.
 */
export const DEESSER_WORKLET = manifestWorklet({
  kernels: DEESSER_KERNELS,
  models: { deesser: "deesser" },
  processor: "audioui-deesser",
});