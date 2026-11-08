import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The drums it synthesizes, each from oscillators and noise. */
export const DRUM_SYNTH_VOICES = [
  { label: "Kick", value: "kick" },
  { label: "Snare", value: "snare" },
  { label: "Clap", value: "clap" },
  { label: "Closed hat", value: "hat" },
  { label: "Open hat", value: "open-hat" },
  { label: "Tom", value: "tom" },
  { label: "Rim", value: "rim" },
  { label: "Cymbal", value: "cymbal" },
] as const;

export type DrumSynthVoice = (typeof DRUM_SYNTH_VOICES)[number]["value"];

/** How long each voice rings at the middle of the decay, in seconds. */
export const VOICE_DECAYS: Readonly<Record<DrumSynthVoice, number>> = {
  clap: 0.12,
  cymbal: 1.6,
  hat: 0.05,
  kick: 0.35,
  "open-hat": 0.22,
  rim: 0.04,
  snare: 0.18,
  tom: 0.3,
};

const unit = (value: number) => value / 10;

/** How long a hit rings, in seconds: the voice's own ring, from an eighth of it to eight times, the middle of the decay its own. */
export const decaySeconds = (voice: DrumSynthVoice, value: number) =>
  VOICE_DECAYS[voice] * 8 ** ((value - 5) / 5);
/** How far the tone moves the voice's filter or its brightness: half as high to twice, the middle where it is. */
export const toneRatio = (value: number) => 2 ** ((value - 5) / 5);
/** A pitch's ratio for `semitones`. */
export const tuneRatio = (semitones: number) => 2 ** (semitones / 12);

const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = 0;

/** The volume's level, as a gain, up to unity: silence at 0. */
export function volumeGain(value: number) {
  if (value <= 0) {
    return 0;
  }
  return (
    10 ** ((MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)) / 20)
  );
}

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
 * A synthesized drum as a device, with no panel and no audio in it: a kick,
 * a snare, a clap, a closed or an open hat, a tom, a rim or a cymbal, each
 * made of a falling sine and filtered noise, tuned, with how long it rings,
 * how bright it is and how sharp its attack. It is an instrument played with
 * a velocity: harder is louder and brighter. A hit rings for its decay
 * whatever the note's length, so one engine plays every hit, as a drum rack's
 * pad does.
 */
export const drumSynthDevice = defineDevice({
  description:
    "A synthesized drum: a kick, a snare, a clap, a closed or an open hat, a tom, a rim or a cymbal from oscillators and noise, with its tuning, how long it rings, how bright it is and how sharp its attack, louder and brighter the harder it is hit.",
  id: "audioui.drum-synth",
  kind: "instrument",
  name: "Drum Synth",
  note: [
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
    {
      default: "kick",
      id: "voice",
      kind: "choice",
      label: "Voice",
      options: DRUM_SYNTH_VOICES,
    },
    {
      default: 0,
      format: (value: number) =>
        `${value > 0 ? "+" : ""}${value.toFixed(1)} st`,
      id: "tune",
      label: "Tune",
      max: 12,
      min: -12,
      step: 0.1,
    },
    control("decay", "Decay", 5),
    control("tone", "Tone", 5),
    control("snap", "Snap", 5),
    control("volume", "Volume", 8, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type DrumSynthState = DeviceState<typeof drumSynthDevice.parameters>;

/** What is played: how hard the drum is hit. */
export interface DrumSynthNote {
  /** How hard the drum is hit, from 0 to 1: louder, and brighter. @default 1 */
  velocity?: number;
}

/** A voice's whole state: the defaults, with the voice set and what `patch` changes. */
export function drumSynthPreset(
  voice: DrumSynthVoice,
  patch: Partial<DrumSynthState> = {}
): DrumSynthState {
  return { ...drumSynthDevice.defaults(), voice, ...patch };
}
