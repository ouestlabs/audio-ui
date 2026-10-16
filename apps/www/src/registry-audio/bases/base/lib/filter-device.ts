import {
  type BiquadType,
  biquadResponse,
  formatHz,
  toWebAudioQ,
  WEB_AUDIO_FILTER_TYPES,
} from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The width a filter has when the resonance is at its lowest: flat, a Butterworth. */
export const FLAT_Q = Math.SQRT1_2;

/**
 * A filter as a device: a type, a cutoff and a resonance, with no panel and no
 * audio in it. A panel draws its state, an engine plays it, an agent drives it
 * through `deviceTools(filterDevice)`.
 */
export const filterDevice = defineDevice({
  description:
    "Takes part of the spectrum out: a low-pass, high-pass, band-pass or notch filter at a cutoff frequency, with a resonance that makes it ring or narrow it.",
  id: "audioui.filter",
  name: "Filter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "lowpass",
      id: "type",
      kind: "choice",
      label: "Type",
      options: [
        { label: "Low-pass", value: "lowpass" },
        { label: "High-pass", value: "highpass" },
        { label: "Band-pass", value: "bandpass" },
        { label: "Notch", value: "notch" },
      ],
    },
    {
      default: 1200,
      format: formatHz,
      id: "cutoffHz",
      label: "Cutoff",
      max: 20_000,
      min: 20,
      scale: "log",
      step: 1,
    },
    {
      default: FLAT_Q,
      format: (q: number) => q.toFixed(2),
      id: "resonance",
      label: "Resonance",
      max: 18,
      min: 0.3,
      scale: "log",
      step: 0.01,
    },
  ],
});

export type FilterState = DeviceState<typeof filterDevice.parameters>;

/** The band type of the shared curve code that each filter type is. A low-pass cuts the highs, so it is a high cut. */
const BAND_TYPES: Record<FilterState["type"], BiquadType> = {
  bandpass: "bandpass",
  highpass: "lowcut",
  lowpass: "highcut",
  notch: "notch",
};

/**
 * The numbers that go on the node for a state, as plain values. Pure, so what
 * an engine sets can be read and tested without an `AudioContext`. `q` is in
 * the unit the node wants: a low-pass and a high-pass read it in decibels.
 */
export function filterSettings(state: FilterState) {
  const band = BAND_TYPES[state.type];
  return {
    dry: state.enabled ? 0 : 1,
    frequency: state.cutoffHz,
    q: toWebAudioQ(band, state.resonance),
    type: WEB_AUDIO_FILTER_TYPES[band],
    wet: state.enabled ? 1 : 0,
  };
}

/** The curve a state plays: the gain in dB at each frequency. Flat when it is off. */
export function filterCurve(state: FilterState) {
  if (!state.enabled) {
    return () => 0;
  }
  return biquadResponse({
    frequency: state.cutoffHz,
    q: state.resonance,
    type: BAND_TYPES[state.type],
  });
}

/** How much a resonance rings over a flat filter, in dB: where a handle sits on the vertical axis. */
export const resonanceDb = (resonance: number) =>
  20 * Math.log10(resonance / FLAT_Q);

/** The resonance for a height in dB over a flat filter: the inverse of `resonanceDb`. */
export const resonanceFromDb = (db: number) => FLAT_Q * 10 ** (db / 20);
