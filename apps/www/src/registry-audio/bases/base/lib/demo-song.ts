/**
 * A chill two-bar song at 80 BPM, on E minor seven, G and A: a strummed
 * guitar and drums drawn here as recordings, as files would arrive, and an
 * organ and a bass as notes for MIDI tracks to play. The guitar is a
 * plucked-string model (a burst of noise round a delay line that loses its
 * highs on each pass), strummed down and up; the drums are oscillators and
 * noise. What an arrangement's demo plays.
 */

import type { Tempo } from "@audio-ui/core/time";

const BPM = 80;
export const SONG_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: BPM };
/** How long the song's loop lasts, in bars. */
export const SONG_BARS = 2;

const BEAT = 60 / BPM;
const BEATS = SONG_BARS * 4;
/** The average level every recording is brought to, -22 dBFS, and the peak none passes. */
const TARGET_RMS = 10 ** (-22 / 20);
const CEILING = 0.9;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

const CHORDS = {
  A: [45, 52, 57, 61, 64],
  Em7: [40, 47, 50, 55, 59, 64],
  G: [43, 47, 50, 55, 59, 67],
} as const;
type Chord = keyof typeof CHORDS;

/** The chord under each beat of the two bars. */
const HARMONY: readonly Chord[] = [
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
/** Where the kick falls, in beats over the two bars: the bass follows it. */
const KICKS = [0, 1.75, 2.5, 4, 5.75, 6.5] as const;

/** A note of the song, as a MIDI clip holds it: its pitch, and its start and length in beats. */
export interface SongNote {
  length: number;
  pitch: number;
  start: number;
  velocity: number;
}

/** The organ's chords: E minor seven for a bar, G and A for two beats each, held a little short of the next. */
const ORGAN: readonly { at: number; beats: number; notes: number[] }[] = [
  { at: 0, beats: 4, notes: [52, 55, 59, 62] },
  { at: 4, beats: 2, notes: [55, 59, 62, 67] },
  { at: 6, beats: 2, notes: [57, 61, 64, 69] },
];
/** The bass: the root of each chord, on the kick, an octave under the guitar's low string. */
const BASS: readonly [start: number, length: number, pitch: number][] = [
  [0, 1.5, 40],
  [1.75, 0.5, 40],
  [2.5, 1.25, 40],
  [4, 1.5, 43],
  [5.75, 0.25, 43],
  [6, 0.4, 45],
  [6.5, 1.25, 45],
];

/** The organ and the bass as notes, for MIDI tracks to play, over the two bars. */
export const SONG_SCORE: Record<"bass" | "organ", SongNote[]> = {
  bass: BASS.map(([start, length, pitch]) => ({
    length,
    pitch,
    start,
    velocity: 0.8,
  })),
  organ: ORGAN.flatMap((chord) =>
    chord.notes.map((pitch) => ({
      length: chord.beats - 0.1,
      pitch,
      start: chord.at,
      velocity: 0.7,
    }))
  ),
};

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

function strum(rate: number, length: number) {
  const out = new Float32Array(length);
  for (let bar = 0; bar < SONG_BARS; bar += 1) {
    for (const stroke of STRUMS) {
      const beat = bar * 4 + stroke.at;
      const notes = CHORDS[HARMONY[Math.floor(beat)] ?? "Em7"];
      const order = stroke.down ? notes : [...notes].reverse();
      for (const [string, note] of order.entries()) {
        pluck(
          out,
          rate,
          beat * BEAT + string * SPREAD,
          stroke.ring * BEAT,
          note,
          stroke.down ? 0.3 : 0.2
        );
      }
    }
  }
  return out;
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
  }: {
    at: number;
    decay: number;
    frequency: number;
    level: number;
    noise?: BiquadFilterType;
  }
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

/** A kick on the song's beats, a snare on two and four, and hats on every eighth, the off-beats softer. */
function drums(ctx: OfflineAudioContext, out: AudioNode) {
  for (const beat of KICKS) {
    hit(ctx, out, { at: beat * BEAT, decay: 0.35, frequency: 50, level: 0.9 });
  }
  for (const beat of [1, 3, 5, 7]) {
    hit(ctx, out, {
      at: beat * BEAT,
      decay: 0.18,
      frequency: 1500,
      level: 0.5,
      noise: "bandpass",
    });
    hit(ctx, out, { at: beat * BEAT, decay: 0.08, frequency: 180, level: 0.3 });
  }
  for (let eighth = 0; eighth < BEATS * 2; eighth += 1) {
    hit(ctx, out, {
      at: (eighth / 2) * BEAT,
      decay: eighth % 2 ? 0.03 : 0.06,
      frequency: 7000,
      level: eighth % 2 ? 0.12 : 0.2,
      noise: "highpass",
    });
  }
}

/** Brings samples to the recordings' shared average level, with no peak past the ceiling. */
function normalize(data: Float32Array) {
  let squares = 0;
  let peak = 0;
  for (const sample of data) {
    squares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(squares / data.length);
  if (rms === 0) {
    return;
  }
  const gain = Math.min(TARGET_RMS / rms, CEILING / peak);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (data[index] ?? 0) * gain;
  }
}

export type SongPart = "drums" | "guitar";

const rendered = new Map<string, Promise<AudioBuffer>>();

/**
 * One recorded part of the song, two bars at its tempo, brought to the level
 * every part has: what an audio track of an arrangement plays. Drawn once per
 * sample rate.
 */
export function renderSongPart(
  part: SongPart,
  sampleRate: number
): Promise<AudioBuffer> {
  const id = `${part}:${sampleRate}`;
  const kept = rendered.get(id);
  if (kept) {
    return kept;
  }
  const length = Math.ceil(sampleRate * BEAT * BEATS);
  let buffer: Promise<AudioBuffer>;
  if (part === "guitar") {
    const data = strum(sampleRate, length);
    normalize(data);
    const made = new AudioBuffer({ length, sampleRate });
    made.copyToChannel(data, 0);
    buffer = Promise.resolve(made);
  } else {
    const ctx = new OfflineAudioContext(1, length, sampleRate);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    drums(ctx, out);
    buffer = ctx.startRendering().then((done) => {
      normalize(done.getChannelData(0));
      return done;
    });
  }
  rendered.set(id, buffer);
  return buffer;
}
