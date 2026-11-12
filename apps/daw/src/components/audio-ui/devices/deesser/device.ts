import { biquadResponse } from "@audio-ui/engine/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { deesser } from "@audio-ui/engine/dsp";
import { formatFrequency } from "@audio-ui/engine/format";
import { DEESSER_KERNELS } from "@audio-ui/engine/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";

/** The Q of each biquad of the crossover the panel's curve draws: two of them in a row are a Linkwitz-Riley filter, whose low and high halves add back to a flat response. */
export const CROSSOVER_Q = Math.SQRT1_2;
/**
 * A de-esser as a device: it takes the highs above a frequency down when they
 * get loud, so the sibilants of a voice sit with the rest, with no panel and no
 * audio in it. It is the de-esser of `@audio/dynamics-deesser`, which tells an
 * s by the highs rising over the voice's body, whatever the level, and takes
 * down the highs, a band or the whole sound.
 */
export const deesserDevice = defineDevice({
  description:
    "Tames the sharp s and t of a voice: when the highs above a frequency get loud they are taken down by the ratio, never by more than the range. Its split, band and wide band models tell an s by how far the highs rise over the voice's body, whatever the level, and take down the highs above the frequency, a band around it as wide as its Q, or the whole sound while the s lasts.",
  id: "audioui.deesser",
  // The model reads the sound ahead of what it cuts: 5 ms.
  latency: (state, sampleRate) =>
    state.enabled
      ? deesser.latency({
          params: { lookahead: Float32Array.of(5) },
          sampleRate,
        }) / sampleRate
      : 0,
  name: "De-esser",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "split",
      id: "model",
      kind: "choice",
      label: "Model",
      options: [
        { label: "Split", value: "split" },
        { label: "Band", value: "band" },
        { label: "Wide band", value: "broadband" },
      ],
    },
    {
      default: 6500,
      format: formatFrequency,
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
  ],
});

export type DeesserState = DeviceState<typeof deesserDevice.parameters>;

/** The controls a model does not use: the Q but for the band. */
export function deesserUnused(model: DeesserState["model"]) {
  return model === "band" ? ([] as const) : (["q"] as const);
}

/** The numbers that go on the worklet for a state, in the manifest's units: the mode by its index, the range as a cut. Off, the range is nothing. */
export function deesserSettings(state: DeesserState) {
  return {
    modelParams: {
      fc: state.frequencyHz,
      mode: deesser.params.mode.values.indexOf(state.model),
      Q: state.q,
      range: state.enabled ? -state.rangeDb : 0,
      ratio: state.ratio,
      split: state.frequencyHz,
      threshold: state.overBodyDb,
    },
  };
}

/**
 * What the device does at each frequency when the highs are taken down as far
 * as the range allows, in dB: what the panel draws. The cut takes its share
 * of the sound at each frequency down to the floor: the highs of the
 * split (matched at the frequency by a crossover of two Butterworth biquads,
 * both halves 6 dB down), a band as wide as the Q, or all of it.
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
 * The source of the de-esser's `AudioWorklet`, processor
 * `audioui-deesser`: the manifest of `@audio/dynamics-deesser`, played by
 * `manifestWorklet`, its mode a parameter. Every parameter makes it again.
 */
export const DEESSER_WORKLET = manifestWorklet({
  kernels: DEESSER_KERNELS,
  models: { deesser: "deesser" },
  processor: "audioui-deesser",
});
