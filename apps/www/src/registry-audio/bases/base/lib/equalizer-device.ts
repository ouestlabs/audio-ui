import {
  type BiquadType,
  type EqBand,
  eqResponse,
  formatHz,
} from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const MAX_DB = 18;

const hz = <const Id extends string>(
  id: Id,
  label: string,
  min: number,
  max: number,
  at: number
) =>
  ({
    default: at,
    format: formatHz,
    id,
    label,
    max,
    min,
    scale: "log",
    step: 1,
  }) as const;

const gain = <const Id extends string>(id: Id, label: string) =>
  ({
    anchor: 0,
    default: 0,
    id,
    label,
    max: MAX_DB,
    min: -MAX_DB,
    step: 0.1,
    unit: "dB",
  }) as const;

/** What a band can be, from the bottom of the spectrum up. */
const FILTER_OPTIONS = [
  { label: "Low cut", value: "lowcut" },
  { label: "Low shelf", value: "lowshelf" },
  { label: "Bell", value: "peak" },
  { label: "Notch", value: "notch" },
  { label: "High shelf", value: "highshelf" },
  { label: "High cut", value: "highcut" },
] as const;

const filter = <const Id extends string>(
  id: Id,
  label: string,
  at: (typeof FILTER_OPTIONS)[number]["value"]
) =>
  ({
    default: at,
    id,
    kind: "choice",
    label,
    options: FILTER_OPTIONS,
  }) as const;

const width = <const Id extends string>(id: Id, label: string, at = 1) =>
  ({
    default: at,
    id,
    label,
    max: 12,
    min: 0.3,
    scale: "log",
    step: 0.01,
  }) as const;

/**
 * A four-band equalizer as a device: four filters in series, each a low cut, a
 * low shelf, a bell, a notch, a high shelf or a high cut, and an output trim, with no panel and no audio in it. A panel
 * draws its state, an engine plays it, an agent drives it through
 * `deviceTools(equalizerDevice)`.
 */
export const equalizerDevice = defineDevice({
  description:
    "Shapes the tone: four filters in series, each with a type (low cut, low shelf, bell, notch, high shelf or high cut), a frequency, a gain where the type has one and a width, then an output trim.",
  id: "audioui.equalizer",
  name: "Equalizer",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    filter("lowType", "Low type", "lowshelf"),
    hz("lowHz", "Low freq", 20, 500, 100),
    gain("lowDb", "Low gain"),
    width("lowQ", "Low Q", Math.SQRT1_2),
    filter("lowMidType", "Low mid type", "peak"),
    hz("lowMidHz", "Low mid freq", 100, 2000, 400),
    gain("lowMidDb", "Low mid gain"),
    width("lowMidQ", "Low mid Q"),
    filter("highMidType", "High mid type", "peak"),
    hz("highMidHz", "High mid freq", 800, 8000, 2500),
    gain("highMidDb", "High mid gain"),
    width("highMidQ", "High mid Q"),
    filter("highType", "High type", "highshelf"),
    hz("highHz", "High freq", 2000, 20_000, 8000),
    gain("highDb", "High gain"),
    width("highQ", "High Q", Math.SQRT1_2),
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

export type EqualizerState = DeviceState<typeof equalizerDevice.parameters>;

/** Which parameters make each band, from the bottom up. The type of each starts as a shelf at the ends and a bell between. */
export const EQUALIZER_BANDS = [
  { db: "lowDb", hz: "lowHz", id: "low", q: "lowQ", type: "lowType" },
  {
    db: "lowMidDb",
    hz: "lowMidHz",
    id: "lowMid",
    q: "lowMidQ",
    type: "lowMidType",
  },
  {
    db: "highMidDb",
    hz: "highMidHz",
    id: "highMid",
    q: "highMidQ",
    type: "highMidType",
  },
  { db: "highDb", hz: "highHz", id: "high", q: "highQ", type: "highType" },
] as const;

/** What each type takes: a shelf and a bell have a gain, a shelf has a fixed slope and no width. */
export const FILTER_TAKES: Record<BiquadType, { gain: boolean; q: boolean }> = {
  bandpass: { gain: false, q: true },
  highcut: { gain: false, q: true },
  highshelf: { gain: true, q: false },
  lowcut: { gain: false, q: true },
  lowshelf: { gain: true, q: false },
  notch: { gain: false, q: true },
  peak: { gain: true, q: true },
};

/** The bands of a state as the filters they are, in series. */
export function equalizerBands(state: EqualizerState): EqBand[] {
  return EQUALIZER_BANDS.map((band) => ({
    frequency: state[band.hz],
    gainDb: state[band.db],
    q: state[band.q],
    type: state[band.type],
  }));
}

/** The curve a state plays: the gain in dB at each frequency, the bands and the trim together. Flat when it is off. */
export function equalizerCurve(state: EqualizerState) {
  if (!state.enabled) {
    return () => 0;
  }
  const bands = eqResponse(equalizerBands(state));
  return (frequency: number) => bands(frequency) + state.outputDb;
}
