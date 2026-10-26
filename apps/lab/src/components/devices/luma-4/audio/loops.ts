/**
 * The loops Luma-4 throbs: three two-bar parts at 80 BPM, made here. The
 * guitar is a plucked-string model (a burst of noise round a delay line that
 * loses its highs on each pass), strummed down and up; the organ and the
 * drums are oscillators and noise. Each is rendered once into a buffer, as a
 * file would arrive, and brought to the same average level.
 */

import type { Source } from "./engine";

const RATE = 44_100;
const BPM = 80;
const BEAT = 60 / BPM;
const BEATS = 8;
const LENGTH = Math.ceil(RATE * BEAT * BEATS);
/** The average level of every loop, -22 dBFS, and the peak none passes. */
const TARGET_RMS = 10 ** (-22 / 20);
const CEILING = 0.9;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

const CHORDS = {
  A: [45, 52, 57, 61, 64],
  Em7: [40, 47, 50, 55, 59, 64],
  G: [43, 47, 50, 55, 59, 67],
} as const;
type Chord = keyof typeof CHORDS;

/** One bar of strums: when, which way, and how long the strings ring before the hand mutes them, in beats. */
const STRUMS = [
  { at: 0, down: true, ring: 1.5 },
  { at: 1.5, down: false, ring: 0.5 },
  { at: 2, down: true, ring: 1 },
  { at: 3, down: true, ring: 0.5 },
  { at: 3.5, down: false, ring: 0.5 },
] as const;
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
/** How far apart the strings of one strum are struck, in seconds. */
const SPREAD = 0.011;

/** One plucked string, added into `out` from `start` for `seconds`, muted at the end. */
function pluck(
  out: Float32Array,
  start: number,
  seconds: number,
  note: number,
  level: number
) {
  const period = Math.max(2, Math.round(RATE / hertz(note)));
  const line = new Float32Array(period);
  // The pick: noise, softened, so the attack is bright but not a click.
  let soft = 0;
  for (let i = 0; i < period; i += 1) {
    soft += (Math.random() * 2 - 1 - soft) * 0.6;
    line[i] = soft;
  }
  const first = Math.round(start * RATE);
  const length = Math.min(out.length - first, Math.round(seconds * RATE));
  const mute = Math.round(0.012 * RATE);
  let index = 0;
  for (let i = 0; i < length; i += 1) {
    const next = (index + 1) % period;
    const sample = line[index] ?? 0;
    // Each pass averages two neighbors and loses a little: the highs die first, as on a string.
    line[index] = 0.996 * 0.5 * (sample + (line[next] ?? 0));
    index = next;
    const fade = Math.min(1, (length - i) / mute);
    out[first + i] = (out[first + i] ?? 0) + sample * level * fade;
  }
}

function guitar() {
  const out = new Float32Array(LENGTH);
  for (let bar = 0; bar < 2; bar += 1) {
    for (const strum of STRUMS) {
      const beat = bar * 4 + strum.at;
      const notes = CHORDS[HARMONY[Math.floor(beat)] ?? "Em7"];
      const order = strum.down ? notes : [...notes].reverse();
      for (const [string, note] of order.entries()) {
        const at = beat * BEAT + string * SPREAD;
        pluck(out, at, strum.ring * BEAT, note, strum.down ? 0.3 : 0.2);
      }
    }
  }
  return out;
}

type Render = (ctx: OfflineAudioContext, out: AudioNode) => void;

function tone(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    frequency,
    hold,
    level,
  }: { at: number; frequency: number; hold: number; level: number }
) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.01);
  gain.gain.setValueAtTime(level, at + hold);
  gain.gain.linearRampToValueAtTime(0, at + hold + 0.05);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + hold + 0.06);
}

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
    const buffer = ctx.createBuffer(1, Math.ceil(RATE * (decay + 0.02)), RATE);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
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
  // A drum's body: a sine whose pitch falls as it sounds.
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(frequency * 2.5, at);
  osc.frequency.exponentialRampToValueAtTime(frequency, at + 0.06);
  osc.connect(gain);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

const ORGAN: readonly {
  at: number;
  beats: number;
  notes: readonly number[];
}[] = [
  { at: 0, beats: 4, notes: [52, 55, 59, 62] },
  { at: 4, beats: 2, notes: [55, 59, 62, 67] },
  { at: 6, beats: 2, notes: [57, 61, 64, 69] },
];
const KICKS = [0, 1.75, 2.5, 4, 5.75, 6.5] as const;

const RENDERS: Record<Exclude<Source, "Guitar">, Render> = {
  Drums(ctx, out) {
    for (const beat of KICKS) {
      hit(ctx, out, {
        at: beat * BEAT,
        decay: 0.35,
        frequency: 50,
        level: 0.9,
      });
    }
    for (const beat of [1, 3, 5, 7]) {
      hit(ctx, out, {
        at: beat * BEAT,
        decay: 0.18,
        frequency: 1500,
        level: 0.5,
        noise: "bandpass",
      });
      hit(ctx, out, {
        at: beat * BEAT,
        decay: 0.08,
        frequency: 180,
        level: 0.3,
      });
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
  },
  Organ(ctx, out) {
    // Three drawbars a note: the pitch, its octave and its twelfth.
    for (const chord of ORGAN) {
      for (const note of chord.notes) {
        const at = chord.at * BEAT;
        const hold = chord.beats * BEAT - 0.06;
        const base = hertz(note);
        tone(ctx, out, { at, frequency: base, hold, level: 0.12 });
        tone(ctx, out, { at, frequency: base * 2, hold, level: 0.07 });
        tone(ctx, out, { at, frequency: base * 3, hold, level: 0.04 });
      }
    }
  },
};

/** Brings samples to the loops' shared average level, with no peak past the ceiling. */
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
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (data[i] ?? 0) * gain;
  }
}

/** Renders one loop, as a decoded file would arrive. */
export async function renderLoop(source: Source) {
  if (source === "Guitar") {
    const buffer = new AudioBuffer({ length: LENGTH, sampleRate: RATE });
    const data = guitar();
    normalize(data);
    buffer.copyToChannel(data, 0);
    return buffer;
  }
  const ctx = new OfflineAudioContext(1, LENGTH, RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  RENDERS[source](ctx, out);
  const buffer = await ctx.startRendering();
  normalize(buffer.getChannelData(0));
  return buffer;
}
