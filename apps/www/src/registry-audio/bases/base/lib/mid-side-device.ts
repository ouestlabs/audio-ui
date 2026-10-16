import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The high-pass that stands for "no bass mono": under the range of hearing, so it passes the whole spectrum. */
const PASS_HZ = 10;

/**
 * A mid/side device: the stereo signal is split into what the two channels
 * share (the mid) and what sets them apart (the side), each has its own level,
 * and the side can lose its lows so the bass stays in the centre, with no panel
 * and no audio in it.
 */
export const midSideDevice = defineDevice({
  description:
    "Sets the centre and the sides of a stereo signal apart: the mid is what both channels share and the side is what sets them apart, each with its own level in dB. Bass mono takes the lows out of the side, so everything under that frequency sits in the centre.",
  id: "audioui.mid-side",
  name: "Mid/side",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 0,
      id: "midDb",
      label: "Mid",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      id: "sideDb",
      label: "Side",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      format: (hz: number) => (hz <= PASS_HZ ? "Off" : formatHz(hz)),
      id: "bassMonoHz",
      label: "Bass mono",
      max: 500,
      min: 0,
      step: 5,
    },
  ],
});

export type MidSideState = DeviceState<typeof midSideDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, both levels are unity and the side keeps its lows. */
export function midSideSettings(state: MidSideState) {
  const on = state.enabled;
  return {
    bassHz: on ? Math.max(PASS_HZ, state.bassMonoHz) : PASS_HZ,
    mid: on ? 10 ** (state.midDb / 20) : 1,
    side: on ? 10 ** (state.sideDb / 20) : 1,
  };
}
