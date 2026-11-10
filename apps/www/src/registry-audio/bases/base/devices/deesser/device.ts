import { biquadResponse, formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

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
 * audio in it. The signal is split in two at the frequency, the highs go
 * through a detector that takes them down over a threshold, and the two halves
 * are added back.
 */
export const deesserDevice = defineDevice({
  description:
    "Tames the sharp s and t of a voice: the signal is split at a frequency, and when the highs above it go over the threshold they are taken down by the ratio, never by more than the range. Listen plays only the highs, to find the frequency.",
  id: "audioui.deesser",
  name: "De-esser",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
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
      default: -32,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -60,
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

/** The numbers that go on the nodes for a state. Off, the range is nothing and the signal passes through the crossover unchanged. */
export function deesserSettings(state: DeesserState) {
  return {
    attack: ATTACK_SECONDS,
    frequency: state.frequencyHz,
    // The least gain the highs can have: the range, as a gain.
    floor: state.enabled ? 10 ** (-state.rangeDb / 20) : 1,
    knee: KNEE_DB,
    // Listen plays the highs alone: the lows are turned down.
    lowGain: state.listen ? 0 : 1,
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
 * as the range allows, in dB: what the panel draws. The two halves of the
 * crossover are in phase, so the highs' gain adds to the lows' amplitude.
 */
export function deesserResponse(state: DeesserState) {
  const low = biquadResponse({
    frequency: state.frequencyHz,
    q: CROSSOVER_Q,
    type: "highcut",
  });
  const high = biquadResponse({
    frequency: state.frequencyHz,
    q: CROSSOVER_Q,
    type: "lowcut",
  });
  const floor = state.enabled ? 10 ** (-state.rangeDb / 20) : 1;
  // Two biquads in a row square the magnitude, so the dB double.
  return (hz: number) =>
    20 *
    Math.log10(
      10 ** ((2 * low(hz)) / 20) + floor * 10 ** ((2 * high(hz)) / 20)
    );
}
