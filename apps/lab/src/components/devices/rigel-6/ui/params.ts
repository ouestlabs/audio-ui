import type { Channel, Knob, Strip } from "../audio/engine";

/** What a strip's controls call when they move: the channel, which control and its value. */
export type OnStrip = <K extends keyof Strip>(
  channel: Channel,
  key: K,
  value: Strip[K]
) => void;
export type OnKnob = (channel: Channel, knob: Knob, value: number) => void;

/** What the panel prints on each channel. */
export const LABELS: Record<Channel, string> = {
  bass: "Bass",
  hats: "Hats",
  keys: "Keys",
  kick: "Kick",
  lead: "Lead",
  snare: "Snare",
};

/** The levels printed beside the faders, in dB; the bottom of the travel is silence. */
export const MARKS = [6, 0, -10, -20, -40];
