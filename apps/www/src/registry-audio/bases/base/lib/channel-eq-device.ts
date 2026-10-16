import { type EqBand, eqResponse, formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const LOW_HZ = 100;
const HIGH_HZ = 6000;
const HIGH_PASS_HZ = 80;
/** A high-pass this low passes everything: how the switch turns it off. */
const HIGH_PASS_OFF_HZ = 10;
const MID_Q = 0.9;

/**
 * A channel EQ as a device: a low shelf and a high shelf at fixed frequencies,
 * a sweepable mid bell, a switch for a high-pass at 80 Hz and an output level,
 * with no panel and no audio in it. The three-band EQ of a mixer strip.
 */
export const channelEqDevice = defineDevice({
  description:
    "The EQ of a mixer strip: a low shelf at 100 Hz, a mid bell you sweep from 120 Hz to 7.5 kHz, a high shelf at 6 kHz, a switch for a high-pass at 80 Hz and an output level.",
  id: "audioui.channel-eq",
  name: "Channel EQ",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    { default: false, id: "highPass", kind: "toggle", label: "HP 80 Hz" },
    {
      anchor: 0,
      default: 0,
      id: "lowDb",
      label: "Low",
      max: 15,
      min: -15,
      step: 0.1,
      unit: "dB",
    },
    {
      default: 1000,
      format: formatHz,
      id: "midHz",
      label: "Mid freq",
      max: 7500,
      min: 120,
      scale: "log",
      step: 1,
    },
    {
      anchor: 0,
      default: 0,
      id: "midDb",
      label: "Mid",
      max: 12,
      min: -12,
      step: 0.1,
      unit: "dB",
    },
    {
      anchor: 0,
      default: 0,
      id: "highDb",
      label: "High",
      max: 15,
      min: -15,
      step: 0.1,
      unit: "dB",
    },
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

export type ChannelEqState = DeviceState<typeof channelEqDevice.parameters>;

/** The four filters of a state, in series: the high-pass, the low shelf, the mid bell and the high shelf. */
export function channelEqBands(state: ChannelEqState): EqBand[] {
  return [
    {
      frequency: state.highPass ? HIGH_PASS_HZ : HIGH_PASS_OFF_HZ,
      type: "lowcut",
    },
    { frequency: LOW_HZ, gainDb: state.lowDb, type: "lowshelf" },
    { frequency: state.midHz, gainDb: state.midDb, q: MID_Q, type: "peak" },
    { frequency: HIGH_HZ, gainDb: state.highDb, type: "highshelf" },
  ];
}

/** The curve a state plays: the gain in dB at each frequency, the filters and the trim together. Flat when it is off. */
export function channelEqCurve(state: ChannelEqState) {
  if (!state.enabled) {
    return () => 0;
  }
  const bands = eqResponse(channelEqBands(state));
  return (frequency: number) => bands(frequency) + state.outputDb;
}
