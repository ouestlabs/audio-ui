/**
 * A chill song at 80 BPM on one two-bar loop, E minor seven, G and A, that
 * every part plays: the verse and the chorus differ by who plays, not by
 * their chords, so the song comes round as a loop does. Its strummed guitar
 * and its drums are drawn here as recordings, as files would arrive, one per
 * part; its organ, its pad, its bass and its lead are notes for MIDI tracks to play.
 * The guitar is a plucked-string model (a burst of noise round a delay line
 * that loses its highs on each pass), strummed down and up; the drums are
 * oscillators and noise. What an arrangement's demo plays.
 */

import type { Tempo } from "@audio-ui/core/time";

const BPM = 80;
export const SONG_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: BPM };

const BEAT = 60 / BPM;
/** The average level the verse's recordings are brought to, -22 dBFS, and the peak no recording passes. */
const TARGET_RMS = 10 ** (-22 / 20);
const CEILING = 0.9;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** The guitar's shapes, low string first. */
const SHAPES = {
  A: [45, 52, 57, 61, 64],
  Em7: [40, 47, 50, 55, 59, 64],
  G: [43, 47, 50, 55, 59, 67],
} as const;
type Shape = keyof typeof SHAPES;

/** The loop, a chord per beat over its two bars. */
const HARMONY: readonly Shape[] = [
  "Em7",
  "Em7",
  "Em7",
  "Em7",
  "G",
  "G",
  "A",
  "A",
];

/** One bar of strums: when, which way, and how long the strings ring before the hand mutes them, in beats. */
const STRUMS = [
  { at: 0, down: true, ring: 1.5 },
  { at: 1.5, down: false, ring: 0.5 },
  { at: 2, down: true, ring: 1 },
  { at: 3, down: true, ring: 0.5 },
  { at: 3.5, down: false, ring: 0.5 },
] as const;
/** How far apart the strings of one strum are struck, in seconds. */
const SPREAD = 0.011;

/** Where the kick falls in a bar, in beats: the bass follows it. */
const KICK = [0, 1.75, 2.5] as const;

/** A note of the song, as a MIDI clip holds it: its pitch, and its start and length in beats. */
export interface SongNote {
  length: number;
  pitch: number;
  start: number;
  velocity: number;
}

type Phrase = readonly [start: number, length: number, pitch: number][];

const notes = (phrase: Phrase, velocity: number): SongNote[] =>
  phrase.map(([start, length, pitch]) => ({ length, pitch, start, velocity }));

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

/**
 * The song's notes by part, for MIDI tracks to play, each as long as its
 * loop. The organ holds the chords and the pad the same an octave up, each
 * voice moving as little as it can; the bass plays the roots on the kick, and
 * in the chorus jumps an octave and walks back to the top; the lead is the
 * chorus's hook over four bars, a call and its answer, each note a tone of
 * the chord under it, starting with it, and let go just before the next so
 * every note is struck anew, in the octave of a tape keyboard's flutes.
 */
export const SONG_SCORE = {
  "bass-chorus": notes(
    [
      [0, 1.5, 40],
      [1.75, 0.5, 52],
      [2.5, 1.25, 40],
      [4, 1.5, 43],
      [5.75, 0.25, 55],
      [6, 0.4, 45],
      [6.5, 1, 45],
      [7.5, 0.4, 47],
    ],
    0.85
  ),
  "bass-verse": notes(
    [
      [0, 1.5, 40],
      [1.75, 0.5, 40],
      [2.5, 1.25, 40],
      [4, 1.5, 43],
      [5.75, 0.25, 43],
      [6, 0.4, 45],
      [6.5, 1.25, 45],
    ],
    0.8
  ),
  lead: notes(
    [
      [0, 1.4, 64],
      [1.5, 0.4, 62],
      [2, 0.9, 59],
      [3, 0.9, 62],
      [4, 1.4, 59],
      [5.5, 0.4, 62],
      [6, 0.9, 61],
      [7, 0.9, 64],
      [8, 1.4, 67],
      [9.5, 0.4, 66],
      [10, 0.9, 64],
      [11, 0.9, 62],
      [12, 0.9, 62],
      [13, 0.9, 59],
      [14, 1.9, 61],
    ],
    0.8
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

/** One plucked string, added into `out` from `start` for `seconds`, muted at the end. */
function pluck(
  out: Float32Array,
  rate: number,
  start: number,
  seconds: number,
  note: number,
  level: number
) {
  const period = Math.max(2, Math.round(rate / hertz(note)));
  const line = new Float32Array(period);
  // The pick: noise, softened, so the attack is bright but not a click.
  let soft = 0;
  for (let index = 0; index < period; index += 1) {
    soft += (Math.random() * 2 - 1 - soft) * 0.6;
    line[index] = soft;
  }
  const first = Math.round(start * rate);
  const length = Math.min(out.length - first, Math.round(seconds * rate));
  const mute = Math.round(0.012 * rate);
  let index = 0;
  for (let sample = 0; sample < length; sample += 1) {
    const next = (index + 1) % period;
    const value = line[index] ?? 0;
    // Each pass averages two neighbours and loses a little: the highs die first, as on a string.
    line[index] = 0.996 * 0.5 * (value + (line[next] ?? 0));
    index = next;
    const fade = Math.min(1, (length - sample) / mute);
    out[first + sample] = (out[first + sample] ?? 0) + value * level * fade;
  }
}

/** The guitar strumming the loop, struck harder for the chorus. */
function strum(force: number, rate: number, length: number) {
  const out = new Float32Array(length);
  for (let bar = 0; bar < HARMONY.length / 4; bar += 1) {
    for (const stroke of STRUMS) {
      const beat = bar * 4 + stroke.at;
      const shape = SHAPES[HARMONY[Math.floor(beat)] ?? "Em7"];
      const order = stroke.down ? shape : [...shape].reverse();
      for (const [string, note] of order.entries()) {
        pluck(
          out,
          rate,
          beat * BEAT + string * SPREAD,
          stroke.ring * BEAT,
          note,
          (stroke.down ? 0.3 : 0.2) * force
        );
      }
    }
  }
  return out;
}

interface Hit {
  at: number;
  decay: number;
  frequency: number;
  level: number;
  noise?: BiquadFilterType;
}

/** A drum hit into `out`: a sine whose pitch falls as it sounds, or noise through a filter. */
function hit(
  ctx: OfflineAudioContext,
  out: AudioNode,
  { at, decay, frequency, level, noise }: Hit
) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  gain.connect(out);
  if (noise) {
    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * (decay + 0.02)),
      ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = noise;
    filter.frequency.value = frequency;
    source.connect(filter).connect(gain);
    source.start(at);
    return;
  }
  const oscillator = ctx.createOscillator();
  oscillator.frequency.setValueAtTime(frequency * 2.5, at);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, at + 0.06);
  oscillator.connect(gain);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.02);
}

const kick = (beat: number): Hit => ({
  at: beat * BEAT,
  decay: 0.35,
  frequency: 50,
  level: 0.9,
});
const snare = (beat: number, level = 1): Hit[] => [
  {
    at: beat * BEAT,
    decay: 0.18,
    frequency: 1500,
    level: 0.5 * level,
    noise: "bandpass",
  },
  { at: beat * BEAT, decay: 0.08, frequency: 180, level: 0.3 * level },
];
const clap = (beat: number): Hit => ({
  at: beat * BEAT + 0.008,
  decay: 0.12,
  frequency: 1100,
  level: 0.35,
  noise: "bandpass",
});
/** Hats on every eighth of `bars`, the off-beats softer, and an open one where `open` says. */
const hats = (bars: number, open: readonly number[] = []): Hit[] =>
  Array.from({ length: bars * 8 }, (_, eighth) => {
    const beat = eighth / 2;
    const off = eighth % 2 === 1;
    const closed = { decay: off ? 0.03 : 0.06, level: off ? 0.12 : 0.2 };
    return {
      at: beat * BEAT,
      frequency: 7000,
      noise: "highpass",
      ...(open.includes(beat % 4) ? { decay: 0.22, level: 0.14 } : closed),
    };
  });
const everyBar = <T>(bars: number, of: (bar: number) => T[]) =>
  Array.from({ length: bars }, (_, bar) => of(bar * 4)).flat();

/**
 * The drums of each part, as hits: the verse's beat, the fill that ends it
 * (a snare roll that grows), and the chorus's, with a clap on the snare, an
 * open hat at the end of each bar and a crash on its first beat.
 */
const DRUMS = {
  "drums-chorus": [
    { at: 0, decay: 1.6, frequency: 4500, level: 0.16, noise: "highpass" },
    ...everyBar(4, (at) => KICK.map((beat) => kick(at + beat))),
    ...everyBar(4, (at) => [
      ...snare(at + 1),
      ...snare(at + 3),
      clap(at + 1),
      clap(at + 3),
    ]),
    ...hats(4, [3.5]),
  ],
  "drums-fill": [
    kick(0),
    ...snare(1),
    ...hats(1).slice(0, 4),
    ...Array.from({ length: 8 }, (_, step) =>
      snare(2 + step / 4, 0.35 + step * 0.09)
    ).flat(),
  ],
  "drums-verse": [
    ...everyBar(2, (at) => KICK.map((beat) => kick(at + beat))),
    ...everyBar(2, (at) => [...snare(at + 1), ...snare(at + 3)]),
    ...hats(2),
  ],
} satisfies Record<string, Hit[]>;

/** Every recording of the song, by id, and how many bars it lasts. */
export const SONG_RECORDINGS = {
  "drums-chorus": 4,
  "drums-fill": 1,
  "drums-verse": 2,
  "guitar-chorus": 2,
  "guitar-verse": 2,
} as const;

export type SongPart = keyof typeof SONG_RECORDINGS;

/** A part's samples, before any level is set. */
function draw(part: SongPart, rate: number): Promise<Float32Array> {
  const length = Math.ceil(rate * BEAT * 4 * SONG_RECORDINGS[part]);
  if (part.startsWith("guitar-")) {
    return Promise.resolve(
      strum(part === "guitar-chorus" ? 1.2 : 1, rate, length)
    );
  }
  const ctx = new OfflineAudioContext(1, length, rate);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  for (const one of DRUMS[part as keyof typeof DRUMS]) {
    hit(ctx, out, one);
  }
  return ctx.startRendering().then((done) => done.getChannelData(0));
}

function measure(data: Float32Array) {
  let squares = 0;
  let peak = 0;
  for (const sample of data) {
    squares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return { peak, rms: Math.sqrt(squares / data.length) };
}

const drawn = new Map<string, Promise<Float32Array>>();
const once = (part: SongPart, rate: number) => {
  const id = `${part}:${rate}`;
  const kept = drawn.get(id) ?? draw(part, rate);
  drawn.set(id, kept);
  return kept;
};

/**
 * One recorded part of the song at its tempo: what an audio track of an
 * arrangement plays. Every part of an instrument takes the gain that brings
 * its verse to the song's level, so the quiet parts stay quiet and the chorus
 * stays the loudest, and none peaks past the ceiling. Drawn once per sample
 * rate.
 */
export async function renderSongPart(
  part: SongPart,
  sampleRate: number
): Promise<AudioBuffer> {
  const verse = measure(
    await once(
      part.startsWith("guitar-") ? "guitar-verse" : "drums-verse",
      sampleRate
    )
  );
  const data = Float32Array.from(await once(part, sampleRate));
  const { peak } = measure(data);
  const gain = Math.min(
    TARGET_RMS / verse.rms,
    CEILING / verse.peak,
    CEILING / peak
  );
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (data[index] ?? 0) * gain;
  }
  const buffer = new AudioBuffer({ length: data.length, sampleRate });
  buffer.copyToChannel(data, 0);
  return buffer;
}
