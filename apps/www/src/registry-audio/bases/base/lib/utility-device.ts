import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/**
 * A utility as a device: gain, pan, stereo width, mono and a phase invert,
 * with no panel and no audio in it. The tool every chain ends up needing.
 */
export const utilityDevice = defineDevice({
  description:
    "Sets the level and the stereo image: a gain, a pan, a width from mono to twice as wide, a mono switch and a phase invert.",
  id: "audioui.utility",
  name: "Utility",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      anchor: 0,
      default: 0,
      id: "gainDb",
      label: "Gain",
      max: 35,
      min: -35,
      step: 0.1,
      unit: "dB",
    },
    {
      anchor: 0,
      default: 0,
      format: (pan: number) =>
        pan === 0 ? "C" : `${pan < 0 ? "L" : "R"}${Math.abs(pan)}`,
      id: "pan",
      label: "Pan",
      max: 100,
      min: -100,
      step: 1,
    },
    {
      default: 100,
      id: "width",
      label: "Width",
      max: 200,
      min: 0,
      step: 1,
      unit: "%",
    },
    { default: false, id: "mono", kind: "toggle", label: "Mono" },
    { default: false, id: "invert", kind: "toggle", label: "Invert" },
  ],
});

export type UtilityState = DeviceState<typeof utilityDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, the signal passes unchanged. */
export function utilitySettings(state: UtilityState) {
  if (!state.enabled) {
    return { gain: 1, pan: 0, width: 1 };
  }
  return {
    gain: 10 ** (state.gainDb / 20) * (state.invert ? -1 : 1),
    pan: state.pan / 100,
    width: state.mono ? 0 : state.width / 100,
  };
}
