/**
 * A chill song at 80 BPM on one two-bar loop, E minor seven, G and A, that
 * every part plays: the verse and the chorus differ by who plays, not by
 * their chords, so the song comes round as a loop does. Everything in it is
 * notes for MIDI tracks to play: its drums on a drum kit's pads, one part
 * each, and its organ, its pad, its bass and its lead. What an arrangement's
 * demo plays.
 */

import type { Tempo } from "@audio-ui/core/time";
import { DRUM_NOTES } from "@/registry-audio/bases/base/lib/drum-kit";

const BPM = 80;
export const SONG_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: BPM };

/** Where the kick falls over the loop's two bars, in beats, on the sixteenths: the bass lands with it. */
const KICK = [0, 0.75, 1.75, 2.5, 4, 4.75, 6, 6.5] as const;
/** The snare's ghost notes, soft, between the backbeats of each bar. */
const GHOSTS = [0.75, 1.75, 2.25, 3.25, 3.75] as const;

/** A note of the song, as a MIDI clip holds it: its pitch, and its start and length in beats. */
export interface SongNote {
  length: number;
  pitch: number;
  start: number;
  velocity: number;
}

type Phrase = readonly (readonly [
  start: number,
  length: number,
  pitch: number,
  velocity?: number,
])[];

/** A phrase's notes, at `velocity` unless a note says its own: a ghost note is played soft. */
const notes = (phrase: Phrase, velocity: number): SongNote[] =>
  phrase.map(([start, length, pitch, own]) => ({
    length,
    pitch,
    start,
    velocity: own ?? velocity,
  }));

/** Chords held for `beats`, from `at`, a little short of the next. */
const held = (
  chords: readonly { at: number; beats: number; notes: number[] }[],
  velocity: number
): SongNote[] =>
  chords.flatMap((chord) =>
    chord.notes.map((pitch) => ({
      length: chord.beats - 0.1,
      pitch,
      start: chord.at,
      velocity,
    }))
  );

/** A drum hit as a note of the kit: its pad, its beat, and how hard. */
const drum = (pad: number, start: number, velocity = 1): SongNote => ({
  length: 0.25,
  pitch: pad,
  start,
  velocity,
});
const everyBar = <T>(bars: number, of: (bar: number) => T[]) =>
  Array.from({ length: bars }, (_, bar) => of(bar * 4)).flat();
/** Hats on every sixteenth of `bars`: the beats loudest, the off-beats a little less, the sixteenths between soft, and an open one where `open` says. */
const hats = (bars: number, open: readonly number[] = []): SongNote[] =>
  Array.from({ length: bars * 16 }, (_, sixteenth) => {
    const beat = sixteenth / 4;
    return open.includes(beat % 4)
      ? drum(DRUM_NOTES.openHat, beat)
      : drum(DRUM_NOTES.hat, beat, [1, 0.3, 0.7, 0.35][sixteenth % 4]);
  });
/** The funk groove over `bars`: the kick with the bass, the snare on two and four with its ghost notes. */
const groove = (bars: number): SongNote[] => [
  ...everyBar(bars / 2, (at) =>
    KICK.map((beat) => drum(DRUM_NOTES.kick, at * 2 + beat))
  ),
  ...everyBar(bars, (at) => [
    drum(DRUM_NOTES.snare, at + 1),
    drum(DRUM_NOTES.snare, at + 3),
    ...GHOSTS.map((beat) => drum(DRUM_NOTES.snare, at + beat, 0.22)),
  ]),
];

/**
 * The drums of each part, as notes of a drum kit (`drumKit`): the verse's
 * funk groove, the fill that ends it (a snare roll that grows), and the
 * chorus's, the same groove with a clap on the snare, an open hat at the end
 * of each bar and a crash on its first beat. The snare and the clap ring in
 * the kit's room.
 */
const DRUMS = {
  "drums-chorus": [
    drum(DRUM_NOTES.crash, 0),
    ...groove(4),
    ...everyBar(4, (at) => [
      drum(DRUM_NOTES.clap, at + 1),
      drum(DRUM_NOTES.clap, at + 3),
    ]),
    ...hats(4, [3.5]),
  ],
  "drums-fill": [
    drum(DRUM_NOTES.kick, 0),
    drum(DRUM_NOTES.snare, 1),
    ...hats(1).slice(0, 8),
    ...Array.from({ length: 8 }, (_, step) =>
      drum(DRUM_NOTES.snare, 2 + step / 4, 0.35 + step * 0.09)
    ),
  ],
  "drums-verse": [...groove(2), ...hats(2)],
} satisfies Record<string, SongNote[]>;

/**
 * The song's notes by part, for MIDI tracks to play, each as long as its
 * loop. The organ holds the chords and the pad the same an octave up, each
 * voice moving as little as it can; the bass leaves room: the organ's root
 * on the first two hits of the kick under each chord, the second softer, a
 * note on the third beat, the A pushed a sixteenth ahead of its chord, and
 * silence between, the chorus dropping to a low B on its last off-beat. The
 * lead is the chorus's hook, played on a keyboard and kept as it was played:
 * D, B and A twice over, the A held, then three Bs and three C sharps picked
 * on the sixteenths before B and A lead back round, each note at the length
 * and the strength it was played with.
 */
export const SONG_SCORE = {
  ...DRUMS,
  "bass-chorus": notes(
    [
      [0, 0.5, 40],
      [0.75, 0.4, 40, 0.7],
      [2.5, 0.5, 40],
      [4, 0.5, 43],
      [4.75, 0.4, 43, 0.7],
      [5.75, 0.9, 45],
      [7.5, 0.3, 35, 0.7],
    ],
    0.9
  ),
  "bass-verse": notes(
    [
      [0, 0.5, 40],
      [0.75, 0.4, 40, 0.7],
      [2.5, 0.5, 40],
      [4, 0.5, 43],
      [4.75, 0.4, 43, 0.7],
      [5.75, 0.9, 45],
    ],
    0.9
  ),
  lead: notes(
    [
      [0, 1, 74, 0.83],
      [1, 0.55, 71, 0.95],
      [1.5, 0.6, 69, 0.8],
      [2, 1.05, 74, 0.77],
      [3, 0.5, 71, 0.98],
      [3.5, 1.55, 69, 0.84],
      [5, 0.15, 71, 0.95],
      [5.25, 0.15, 71, 0.85],
      [5.5, 0.6, 71, 0.8],
      [6, 0.15, 73],
      [6.25, 0.1, 73, 0.96],
      [6.5, 0.5, 73],
      [7, 0.6, 71, 0.96],
      [7.5, 0.45, 69, 0.85],
    ],
    1
  ),
  pad: held(
    [
      { at: 0, beats: 4, notes: [64, 67, 71, 74] },
      { at: 4, beats: 2, notes: [62, 67, 71, 74] },
      { at: 6, beats: 2, notes: [61, 64, 69, 73] },
    ],
    0.6
  ),
  organ: held(
    [
      { at: 0, beats: 4, notes: [52, 55, 59, 62] },
      { at: 4, beats: 2, notes: [55, 59, 62, 67] },
      { at: 6, beats: 2, notes: [57, 61, 64, 69] },
    ],
    0.7
  ),
} satisfies Record<string, SongNote[]>;

export type SongScorePart = keyof typeof SONG_SCORE;
