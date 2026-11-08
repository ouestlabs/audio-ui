import {
  type DrumPad,
  newRack,
  type Rack,
  type TrackDevice,
} from "@/lib/arrangement";
import {
  type DrumSynthState,
  type DrumSynthVoice,
  drumSynthDevice,
  drumSynthPreset,
} from "@/components/audio-ui/devices/drum-synth/device";
import { reverbDevice } from "@/components/audio-ui/devices/reverb/device";

/** The kit's pads: the note each answers, on the notes General MIDI writes drums on, its name and its voice. */
export const DRUM_KIT_PADS: readonly {
  /** Its choke group, the hats': the closed one cuts the open one short. */
  choke?: number;
  name: string;
  note: number;
  /** Where it sits, from -1 (left) to 1 (right), as a kit is heard from in front of it. @default 0 */
  pan?: number;
  /** Whether it plays in the small room. */
  room?: boolean;
  sound?: Partial<DrumSynthState>;
  voice: DrumSynthVoice;
}[] = [
  { name: "Kick", note: 36, voice: "kick" },
  { name: "Rim", note: 37, pan: 0.15, voice: "rim" },
  { name: "Snare", note: 38, room: true, voice: "snare" },
  { name: "Clap", note: 39, room: true, voice: "clap" },
  { choke: 1, name: "Closed Hat", note: 42, pan: -0.3, voice: "hat" },
  { name: "Low Tom", note: 43, pan: 0.25, sound: { tune: -5 }, voice: "tom" },
  { choke: 1, name: "Open Hat", note: 46, pan: -0.3, voice: "open-hat" },
  { name: "Mid Tom", note: 47, pan: -0.15, voice: "tom" },
  { name: "Crash", note: 49, pan: 0.35, voice: "cymbal" },
];

/** The kit's notes, by the pad's voice: what a part is written with. */
export const DRUM_NOTES = {
  clap: 39,
  crash: 49,
  hat: 42,
  kick: 36,
  lowTom: 43,
  midTom: 47,
  openHat: 46,
  rim: 37,
  snare: 38,
} as const;

/** The small room the snare and the clap play in: a short, dark plate, a little of it heard. */
const ROOM = { dampingHz: 6000, decay: 1.6, mix: 30, preDelayMs: 18 };

/** A slug of a pad's name, for its ids. */
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/**
 * The kit as a drum rack: a pad per entry of `DRUM_KIT_PADS`, each a chain
 * with its Drum Synth at its head and, for the snare and the clap, the room
 * after it. Its ids start with `prefix`; a host that adds it to a project
 * gives them ids no other chain or device has.
 */
export function drumKit(prefix = "kit"): Rack {
  return {
    chains: DRUM_KIT_PADS.map(
      ({ choke, name, note, pan, room, sound, voice }) => {
        const id = `${prefix}-${slug(name)}`;
        const devices: TrackDevice[] = [
          {
            device: drumSynthDevice.id,
            id: `${id}-synth`,
            instrument: true,
            state: drumSynthPreset(voice, sound),
          },
          ...(room
            ? [
                {
                  device: reverbDevice.id,
                  id: `${id}-room`,
                  state: { ...reverbDevice.defaults(), ...ROOM },
                },
              ]
            : []),
        ];
        const pad: DrumPad = choke === undefined ? { note } : { choke, note };
        return {
          devices,
          id,
          ...(pan
            ? { mix: { gain: 1, muted: false, pan, soloed: false } }
            : {}),
          name,
          pad,
        };
      }
    ),
    macros: newRack("").macros,
  };
}