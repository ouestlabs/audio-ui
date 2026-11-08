/**
 * A chill song at 80 BPM on one two-bar loop, E minor seven, G and A, that
 * every part plays: the verse and the chorus differ by who plays, not by
 * their chords, so the song comes round as a loop does. Its drums are drawn
 * here as recordings, as files would arrive, one per part, from oscillators
 * and noise; its guitar, its organ, its pad, its bass and its lead are notes
 * for MIDI tracks to play. What an arrangement's demo plays.
 */

import type { Tempo } from "@audio-ui/core/time";

const BPM = 80;
export const SONG_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: BPM };

const BEAT = 60 / BPM;
/** The average level the verse's recordings are brought to, -22 dBFS, and the peak no recording passes. */
const TARGET_RMS = 10 ** (-22 / 20);
const CEILING = 0.9;
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

/**
 * The song's notes by part, for MIDI tracks to play, each as long as its
 * loop. The organ holds the chords and the pad the same an octave up, each
 * voice moving as little as it can; the bass leaves room: the organ's root
 * on the first two hits of the kick under each chord, the second softer, a
 * note on the third beat, the A pushed a sixteenth ahead of its chord, and
 * silence between, the chorus dropping to a low B on its last off-beat. The
 * guitar picks the chords one string at a time, on the eighths: up from the
 * root and back down over E minor seven, up over G and over A, each string
 * left to ring until its chord changes or it is picked again, so the
 * arpeggio sounds as the chord;
 * picked harder in the chorus. The lead is the chorus's hook over four bars, a call
 * and its answer, each note a tone of the chord under it, starting with it,
 * and let go just before the next so every note is struck anew, in the octave
 * of a tape keyboard's flutes.
 */
export const SONG_SCORE = {
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
  "guitar-chorus": notes(
    [
      [0, 3.95, 40],
      [0.5, 2.95, 47],
      [1, 1.95, 50],
      [1.5, 0.95, 55],
      [2, 1.95, 59],
      [2.5, 1.45, 55],
      [3, 0.95, 50],
      [3.5, 0.45, 47],
      [4, 1.95, 43],
      [4.5, 1.45, 47],
      [5, 0.95, 50],
      [5.5, 0.45, 55],
      [6, 1.95, 45],
      [6.5, 1.45, 52],
      [7, 0.95, 57],
      [7.5, 0.45, 61],
    ],
    0.95
  ),
  "guitar-verse": notes(
    [
      [0, 3.95, 40],
      [0.5, 2.95, 47],
      [1, 1.95, 50],
      [1.5, 0.95, 55],
      [2, 1.95, 59],
      [2.5, 1.45, 55],
      [3, 0.95, 50],
      [3.5, 0.45, 47],
      [4, 1.95, 43],
      [4.5, 1.45, 47],
      [5, 0.95, 50],
      [5.5, 0.45, 55],
      [6, 1.95, 45],
      [6.5, 1.45, 52],
      [7, 0.95, 57],
      [7.5, 0.45, 61],
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

interface Hit {
  at: number;
  decay: number;
  frequency: number;
  level: number;
  noise?: BiquadFilterType;
  /** How far above its pitch a drum starts, and how long it takes to fall to it, in seconds: a kick drops fast, a tom sags. */
  pitchDrop?: { ratio: number; seconds: number };
  /** Whether it goes through the room, a reverb. */
  room?: boolean;
}

/** A drum hit into `out`: a sine whose pitch falls as it sounds, or noise through a filter. */
function hit(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    frequency,
    level,
    noise,
    pitchDrop = { ratio: 2.5, seconds: 0.06 },
  }: Hit
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
  oscillator.frequency.setValueAtTime(frequency * pitchDrop.ratio, at);
  oscillator.frequency.exponentialRampToValueAtTime(
    frequency,
    at + pitchDrop.seconds
  );
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
/** A snare hit, dry: what the ghost notes play. */
const snare = (beat: number, level = 1): Hit[] => [
  {
    at: beat * BEAT,
    decay: 0.18,
    frequency: 1500,
    level: 0.5 * level,
    noise: "bandpass",
  },
  {
    at: beat * BEAT,
    decay: 0.08,
    frequency: 180,
    level: 0.3 * level,
  },
];
const clap = (beat: number, room = false): Hit => ({
  at: beat * BEAT + 0.008,
  decay: 0.12,
  frequency: 1100,
  level: 0.35,
  noise: "bandpass",
  room,
});
/** Where the toms sit, in hertz: a high one that calls and a low one that answers. */
const TOMS = { high: 150, low: 98 } as const;
/** A tom in the room: a skin that sags in pitch as it rings, and the stick's click on it, `level` from 0 to 1. */
const tom = (beat: number, frequency: number, level = 1): Hit[] => [
  {
    at: beat * BEAT,
    decay: 0.55,
    frequency,
    level: 0.75 * level,
    pitchDrop: { ratio: 1.5, seconds: 0.14 },
    room: true,
  },
  {
    at: beat * BEAT,
    decay: 0.03,
    frequency: 2500,
    level: 0.2 * level,
    noise: "bandpass",
    room: true,
  },
];
/** Hats on every sixteenth of `bars`: the beats loudest, the off-beats a little less, the sixteenths between soft, and an open one where `open` says. */
const hats = (bars: number, open: readonly number[] = []): Hit[] =>
  Array.from({ length: bars * 16 }, (_, sixteenth) => {
    const beat = sixteenth / 4;
    const accent = [0.2, 0.06, 0.14, 0.07][sixteenth % 4] ?? 0.06;
    return {
      at: beat * BEAT,
      frequency: 7000,
      noise: "highpass",
      ...(open.includes(beat % 4)
        ? { decay: 0.22, level: 0.14 }
        : { decay: sixteenth % 2 ? 0.025 : 0.05, level: accent }),
    };
  });
const everyBar = <T>(bars: number, of: (bar: number) => T[]) =>
  Array.from({ length: bars }, (_, bar) => of(bar * 4)).flat();
/** The groove over `bars`: the kick with the bass, a high tom on two and a low one on four that answers, and the snare's ghost notes between. */
const groove = (bars: number): Hit[] => [
  ...everyBar(bars / 2, (at) => KICK.map((beat) => kick(at * 2 + beat))),
  ...everyBar(bars, (at) => [
    ...tom(at + 1, TOMS.high),
    ...tom(at + 3, TOMS.low),
    ...GHOSTS.flatMap((beat) => snare(at + beat, 0.22)),
  ]),
];

/**
 * The drums of each part, as hits: the verse's groove, with its toms on the
 * backbeat; the fill that ends it, a roll down from the high tom to the low
 * one that grows, as a talking drum's; and the chorus's, the same groove with
 * a clap on the toms, an open hat at the end of each bar and a crash on its
 * first beat.
 */
const DRUMS = {
  "drums-chorus": [
    { at: 0, decay: 1.6, frequency: 4500, level: 0.16, noise: "highpass" },
    ...groove(4),
    ...everyBar(4, (at) => [clap(at + 1, true), clap(at + 3, true)]),
    ...hats(4, [3.5]),
  ],
  "drums-fill": [
    kick(0),
    ...tom(1, TOMS.high),
    ...hats(1).slice(0, 8),
    // Down from the high tom to the low one, louder as it goes, as a talking drum calls into the chorus.
    ...Array.from({ length: 8 }, (_, step) =>
      tom(
        2 + step / 4,
        TOMS.high * (TOMS.low / TOMS.high) ** (step / 7),
        0.3 + step * 0.06
      )
    ).flat(),
  ],
  "drums-verse": [...groove(2), ...hats(2)],
} satisfies Record<string, Hit[]>;

/** Every recording of the song, by id, and how many bars it lasts. */
export const SONG_RECORDINGS = {
  "drums-chorus": 4,
  "drums-fill": 1,
  "drums-verse": 2,
} as const;

export type SongPart = keyof typeof SONG_RECORDINGS;

/** A part's samples, before any level is set. */
/** The toms' room: how long its tail lasts, in seconds, how long before it answers, and how much of it is heard. */
const ROOM = { delay: 0.018, seconds: 1.6, wet: 0.45 } as const;

/** A room's answer to a hit: noise that fades and darkens as it fades, as a plate's tail does. */
function roomImpulse(ctx: BaseAudioContext) {
  const length = Math.ceil(ctx.sampleRate * ROOM.seconds);
  const start = Math.round(ctx.sampleRate * ROOM.delay);
  const buffer = ctx.createBuffer(1, length + start, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let dark = 0;
  for (let index = 0; index < length; index += 1) {
    const fade = (1 - index / length) ** 3;
    // The tail loses its highs as it fades: the noise is smoothed more and more.
    dark += (Math.random() * 2 - 1 - dark) * (0.7 - 0.6 * (index / length));
    data[start + index] = dark * fade * 0.25;
  }
  return buffer;
}

/**
 * A part's samples, before any level is set. The toms and the claps go
 * through a room as well, while the ghost notes stay dry; the room's tail,
 * past the end, comes round to the start, as the part loops.
 */
function draw(part: SongPart, rate: number): Promise<Float32Array> {
  const length = Math.ceil(rate * BEAT * 4 * SONG_RECORDINGS[part]);
  const tail = Math.ceil(rate * (ROOM.seconds + ROOM.delay));
  const ctx = new OfflineAudioContext(1, length + tail, rate);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const room = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.normalize = false;
  reverb.buffer = roomImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = ROOM.wet;
  room.connect(out);
  room.connect(reverb).connect(wet).connect(out);
  for (const one of DRUMS[part]) {
    hit(ctx, one.room ? room : out, one);
  }
  return ctx.startRendering().then((done) => {
    const data = done.getChannelData(0);
    const looped = data.slice(0, length);
    for (let index = length; index < data.length; index += 1) {
      const at = (index - length) % length;
      looped[at] = (looped[at] ?? 0) + (data[index] ?? 0);
    }
    return looped;
  });
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
 * arrangement plays. Every part takes the gain that brings the verse's drums
 * to the song's level, so the fill and the chorus keep their own, and none
 * peaks past the ceiling. Drawn once per sample rate.
 */
export async function renderSongPart(
  part: SongPart,
  sampleRate: number
): Promise<AudioBuffer> {
  const verse = measure(await once("drums-verse", sampleRate));
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
