import { type DeviceState, defineDevice } from "@audio-ui/engine/device";

/** The 35 keys that have a tape under them, as MIDI notes: G2 to F5. */
export const TAPE_KEYS_LOWEST = 43;
export const TAPE_KEYS_HIGHEST = 77;
/** How long a strip of tape plays, in seconds, before it runs out. */
export const TAPE_SECONDS = 8;

const unit = (value: number) => value / 10;

/** The speed control: up to a whole tone slower or faster, in cents. */
export const speedCents = (value: number) => (value - 5) * 40;
export const toneHertz = (value: number) => 1200 * 12 ** unit(value);

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
 * A tape-replay keyboard as a device, with no panel and no audio in it: under
 * each of its 35 keys lies a strip of tape with one note recorded on it, on
 * three tracks (flutes, strings and a choir). A key runs its tape for eight
 * seconds at most, through the tape's speed, wow and flutter, and a tone
 * control. It is an instrument, played with notes (a pitch in hertz); its keys
 * are not touch-sensitive. An engine plays one key, a host gives it as many
 * as it holds notes.
 */
export const tapeKeysDevice = defineDevice({
  description:
    "A tape-replay keyboard: 35 keys, each a strip of tape with one note on it, on three tracks, flutes, strings and a choir, that runs out after eight seconds, with the tape's speed, wow and flutter, and a tone control.",
  id: "audioui.tape-keys",
  kind: "instrument",
  name: "Tape Keys",
  note: [
    {
      default: 261.63,
      id: "frequency",
      label: "Pitch",
      max: 700,
      min: 95,
      scale: "log",
      unit: "Hz",
    },
  ],
  parameters: [
    {
      default: "strings",
      id: "station",
      kind: "choice",
      label: "Track",
      options: [
        { label: "Flutes", value: "flutes" },
        { label: "Strings", value: "strings" },
        { label: "Choir", value: "choir" },
      ],
    },
    control("speed", "Speed", 5, (value) => {
      const cents = Math.round(speedCents(value));
      return `${cents > 0 ? "+" : ""}${cents} ct`;
    }),
    control("wow", "Wow and flutter", 4),
    control("tone", "Tone", 6, (value) => hz(toneHertz(value))),
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type TapeKeysState = DeviceState<typeof tapeKeysDevice.parameters>;

/** What is played: a pitch in hertz, the key nearest to it. The keys are not touch-sensitive. */
export interface TapeKeysNote {
  frequency: number;
}
