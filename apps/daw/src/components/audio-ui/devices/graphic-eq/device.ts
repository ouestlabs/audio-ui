import { type EqBand, eqResponse } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** How far a band boosts or cuts, in dB. */
const BAND_DB = 15;
/** Every band's width: an octave apart, they meet without a gap or a hump. */
const BAND_Q = 1.4;

const band = <const Id extends string>(id: Id, label: string) =>
  ({
    anchor: 0,
    default: 0,
    id,
    label,
    max: BAND_DB,
    min: -BAND_DB,
    step: 0.5,
    unit: "dB",
  }) as const;

/**
 * A graphic EQ as a device: ten bells an octave apart, from 31 Hz to 16 kHz,
 * each with a gain of its own, and an output level, with no panel and no audio
 * in it.
 */
export const graphicEqDevice = defineDevice({
  description:
    "Shapes the tone with ten bands an octave apart, from 31 Hz to 16 kHz, each a bell with a gain of its own, then an output level.",
  id: "audioui.graphic-eq",
  name: "Graphic EQ",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    band("band31", "31 Hz"),
    band("band63", "63 Hz"),
    band("band125", "125 Hz"),
    band("band250", "250 Hz"),
    band("band500", "500 Hz"),
    band("band1k", "1 kHz"),
    band("band2k", "2 kHz"),
    band("band4k", "4 kHz"),
    band("band8k", "8 kHz"),
    band("band16k", "16 kHz"),
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

export type GraphicEqState = DeviceState<typeof graphicEqDevice.parameters>;

/**
 * The ten bands, at the octave centres of ISO 266 as `@audio/eq-graphic`
 * places them, each with the parameter of its gain and the name it is marked
 * by.
 */
export const GRAPHIC_EQ_BANDS = [
  { hz: 31.5, id: "band31", mark: "31" },
  { hz: 63, id: "band63", mark: "63" },
  { hz: 125, id: "band125", mark: "125" },
  { hz: 250, id: "band250", mark: "250" },
  { hz: 500, id: "band500", mark: "500" },
  { hz: 1000, id: "band1k", mark: "1k" },
  { hz: 2000, id: "band2k", mark: "2k" },
  { hz: 4000, id: "band4k", mark: "4k" },
  { hz: 8000, id: "band8k", mark: "8k" },
  { hz: 16_000, id: "band16k", mark: "16k" },
] as const;

/** The bands of a state as the filters they are, in series. Off, every band is flat. */
export function graphicEqBands(state: GraphicEqState): EqBand[] {
  return GRAPHIC_EQ_BANDS.map((each) => ({
    frequency: each.hz,
    gainDb: state.enabled ? state[each.id] : 0,
    q: BAND_Q,
    type: "peak",
  }));
}

/** The curve a state plays: the gain in dB at each frequency, the bands and the output together. Flat when it is off. */
export function graphicEqCurve(state: GraphicEqState) {
  if (!state.enabled) {
    return () => 0;
  }
  const bands = eqResponse(graphicEqBands(state));
  return (frequency: number) => bands(frequency) + state.outputDb;
}