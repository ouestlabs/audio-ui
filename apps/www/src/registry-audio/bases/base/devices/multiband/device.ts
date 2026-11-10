import { biquadResponse, formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The Q of each biquad of a crossover: two in a row are a Linkwitz-Riley filter, whose halves add back to a flat response. */
export const CROSSOVER_Q = Math.SQRT1_2;
/** The soft knee of each band's detector, in dB. */
export const KNEE_DB = 6;

const formatRatio = (ratio: number) => `${ratio.toFixed(1)}:1`;

export const BANDS = ["low", "mid", "high"] as const;
export type Band = (typeof BANDS)[number];

/**
 * A multiband compressor as a device: the signal is split in three at two
 * frequencies, each band has its own threshold and ratio, and the three are
 * added back, with no panel and no audio in it. A loud bass does not pump the
 * highs, and a harsh band can be held down without dulling the rest.
 */
export const multibandDevice = defineDevice({
  description:
    "Compresses three bands apart: the signal is split at two frequencies into low, mid and high, each with its own threshold and ratio, with an attack and a release shared by the three and an output gain. A loud bass does not pump the highs.",
  id: "audioui.multiband",
  name: "Multiband compressor",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 200,
      format: formatHz,
      id: "lowHz",
      label: "Low split",
      max: 1000,
      min: 40,
      scale: "log",
      step: 1,
    },
    {
      default: 3000,
      format: formatHz,
      id: "highHz",
      label: "High split",
      max: 12_000,
      min: 1200,
      scale: "log",
      step: 10,
    },
    {
      default: -24,
      id: "lowThresholdDb",
      label: "Low threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 3,
      format: formatRatio,
      id: "lowRatio",
      label: "Low ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: -26,
      id: "midThresholdDb",
      label: "Mid threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 3,
      format: formatRatio,
      id: "midRatio",
      label: "Mid ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: -28,
      id: "highThresholdDb",
      label: "High threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 3,
      format: formatRatio,
      id: "highRatio",
      label: "High ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: 10,
      id: "attackMs",
      label: "Attack",
      max: 100,
      min: 0.5,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 150,
      id: "releaseMs",
      label: "Release",
      max: 1000,
      min: 20,
      scale: "log",
      step: 1,
      unit: "ms",
    },
    {
      default: 0,
      id: "outputDb",
      label: "Output",
      max: 12,
      min: -12,
      step: 0.5,
      unit: "dB",
    },
  ],
});

export type MultibandState = DeviceState<typeof multibandDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, the ratios are 1 and the output is unity: the three bands add back to the signal. */
export function multibandSettings(state: MultibandState) {
  const on = state.enabled;
  const bands = BANDS.map((id) => ({
    attack: state.attackMs / 1000,
    knee: KNEE_DB,
    ratio: on ? state[`${id}Ratio`] : 1,
    release: state.releaseMs / 1000,
    threshold: state[`${id}ThresholdDb`],
  }));
  return {
    bands,
    highHz: state.highHz,
    lowHz: state.lowHz,
    output: on ? 10 ** (state.outputDb / 20) : 1,
  };
}

/**
 * What each band keeps of the signal, in dB at each frequency: what the panel
 * draws. Each crossover is two biquads in a row, so a band's magnitude is the
 * product of the squared magnitudes of the filters it goes through.
 */
export function multibandBands(
  state: Pick<MultibandState, "highHz" | "lowHz">
) {
  const squared = (type: "highcut" | "lowcut", frequency: number) => {
    const response = biquadResponse({ frequency, q: CROSSOVER_Q, type });
    return (hz: number) => 2 * response(hz);
  };
  const lowCut = squared("highcut", state.lowHz);
  const lowRest = squared("lowcut", state.lowHz);
  const highCut = squared("highcut", state.highHz);
  const highRest = squared("lowcut", state.highHz);
  return {
    high: (hz: number) => lowRest(hz) + highRest(hz),
    low: (hz: number) => lowCut(hz),
    mid: (hz: number) => lowRest(hz) + highCut(hz),
  };
}
