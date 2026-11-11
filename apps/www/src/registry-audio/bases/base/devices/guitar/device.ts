import { type DeviceState, defineDevice } from "@audio-ui/engine/device";

/** The keys the panel's keyboard shows, as MIDI notes: the open low E to the E three octaves up. Any pitch plays. */
export const GUITAR_LOWEST = 40;
export const GUITAR_HIGHEST = 76;

const unit = (value: number) => value / 10;

/** How long a string open rings before it falls 60 dB, in seconds: from a short pluck to a long sustain. */
export const decaySeconds = (value: number) => 0.4 * 15 ** unit(value);
/** How much of its ring the palm leaves a string: all of it, open, down to a tenth, muted. */
export const muteShare = (value: number) => 1 - 0.9 * unit(value);
/** Where the tone control darkens the sound. */
export const toneHertz = (value: number) => 1500 * 8 ** unit(value);
/** The body's warmth, in decibels, at its resonance. */
export const bodyDecibels = (value: number) => unit(value) * 10;

const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;

/** The volume's level, in decibels, never above -3 dB: silence at 0. */
export function volumeGain(value: number) {
  if (value <= 0) {
    return 0;
  }
  return (
    10 ** ((MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)) / 20)
  );
}

const hz = (hertz: number) =>
  hertz < 1000 ? `${Math.round(hertz)} Hz` : `${(hertz / 1000).toFixed(1)} kHz`;
const tenth = (value: number) => value.toFixed(1);

/** A control from 0 to 10, as the panel's are. */
const control = <const Id extends string>(
  id: Id,
  label: string,
  defaultValue: number,
  format: (value: number) => string = tenth
) => ({
  default: defaultValue,
  format,
  id,
  label,
  max: 10,
  min: 0,
  step: 0.1,
});

/**
 * A plucked guitar string as a device, with no panel and no audio in it: a
 * pick strikes a string that rings and fades, its highs first, through the
 * guitar's body and a tone control. The palm can mute the strings. It is an
 * instrument, played with notes (a pitch in hertz and a velocity); an engine
 * plays one string, a host gives it as many as it holds notes.
 */
export const guitarDevice = defineDevice({
  description:
    "A plucked guitar string: a pick strikes it and it rings, its highs dying first, through the body's warmth and a tone control, with how long it rings and how much the palm mutes it.",
  id: "audioui.guitar",
  kind: "instrument",
  name: "Guitar",
  note: [
    {
      default: 196,
      id: "frequency",
      label: "Pitch",
      max: 1400,
      min: 70,
      scale: "log",
      unit: "Hz",
    },
    {
      default: 1,
      id: "velocity",
      label: "Velocity",
      max: 1,
      min: 0,
      step: 0.01,
    },
  ],
  parameters: [
    control("tone", "Tone", 5, (value) => hz(toneHertz(value))),
    control(
      "decay",
      "Decay",
      5,
      (value) => `${decaySeconds(value).toFixed(1)} s`
    ),
    control(
      "mute",
      "Palm mute",
      0,
      (value) => `${Math.round((1 - muteShare(value)) * 100)}%`
    ),
    control(
      "body",
      "Body",
      5,
      (value) => `+${bodyDecibels(value).toFixed(1)} dB`
    ),
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type GuitarState = DeviceState<typeof guitarDevice.parameters>;

/** What is played: a pitch in hertz, and how hard the string is picked. */
export interface GuitarNote {
  frequency: number;
  /** How hard the string is picked, from 0 to 1: louder, and brighter. @default 1 */
  velocity?: number;
}
