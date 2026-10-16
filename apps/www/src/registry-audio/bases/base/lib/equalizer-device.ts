import { type EqBand, eqResponse, formatHz } from "@audio-ui/core/analysis";
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

const width = <const Id extends string>(id: Id, label: string) =>
  ({
    default: 1,
    id,
    label,
    max: 12,
    min: 0.3,
    scale: "log",
    step: 0.01,
  }) as const;

/**
 * A four-band equalizer as a device: a low shelf, two bells and a high shelf
 * in series, and an output trim, with no panel and no audio in it. A panel
 * draws its state, an engine plays it, an agent drives it through
 * `deviceTools(equalizerDevice)`.
 */
export const equalizerDevice = defineDevice({
  description:
    "Shapes the tone: a low shelf, two bells with a frequency, a gain and a width, and a high shelf, in series, then an output trim.",
  id: "audioui.equalizer",
  name: "Equalizer",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    hz("lowHz", "Low freq", 20, 500, 100),
    gain("lowDb", "Low gain"),
    hz("lowMidHz", "Low mid freq", 100, 2000, 400),
    gain("lowMidDb", "Low mid gain"),
    width("lowMidQ", "Low mid Q"),
    hz("highMidHz", "High mid freq", 800, 8000, 2500),
    gain("highMidDb", "High mid gain"),
    width("highMidQ", "High mid Q"),
    hz("highHz", "High freq", 2000, 20_000, 8000),
    gain("highDb", "High gain"),
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

/** Which parameters make each band, and what kind of filter it is, from the bottom up. */
export const EQUALIZER_BANDS = [
  { db: "lowDb", hz: "lowHz", id: "low", type: "lowshelf" },
  { db: "lowMidDb", hz: "lowMidHz", id: "lowMid", q: "lowMidQ", type: "peak" },
  {
    db: "highMidDb",
    hz: "highMidHz",
    id: "highMid",
    q: "highMidQ",
    type: "peak",
  },
  { db: "highDb", hz: "highHz", id: "high", type: "highshelf" },
] as const;

/** The bands of a state as the filters they are, in series. */
export function equalizerBands(state: EqualizerState): EqBand[] {
  return EQUALIZER_BANDS.map((band) => ({
    frequency: state[band.hz],
    gainDb: state[band.db],
    q: "q" in band ? state[band.q] : undefined,
    type: band.type,
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
