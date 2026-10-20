/**
 * The loops Deneb-1 echoes: three short parts made here with oscillators and
 * noise, two bars at 90 BPM with room between the notes, so the repeats can be
 * heard. Each is rendered once into a buffer, as a file would arrive, and
 * brought to the same peak.
 */

import type { Source } from "./engine";

const RATE = 44_100;
const BPM = 90;
const BEAT = 60 / BPM;
const BEATS = 8;
/** The average level of every loop, -22 dBFS, and the peak none passes. */
const TARGET_RMS = 10 ** (-22 / 20);
const CEILING = 0.9;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Render = (ctx: OfflineAudioContext, out: AudioNode) => void;

/** A partial with a falling envelope. */
function partial(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    frequency,
    level,
    type = "sine",
  }: {
    at: number;
    decay: number;
    frequency: number;
    level: number;
    type?: OscillatorType;
  }
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

function noise(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    frequency,
    level,
  }: { at: number; decay: number; frequency: number; level: number }
) {
  const buffer = ctx.createBuffer(1, Math.ceil(RATE * (decay + 0.02)), RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
}

const STABS = [
  { at: 0, notes: [57, 60, 64, 67] },
  { at: 2.5, notes: [53, 57, 60, 64] },
  { at: 4, notes: [50, 53, 57, 60] },
  { at: 6.5, notes: [52, 56, 59, 62] },
];
const PLUCKS = [
  [0, 64],
  [1, 67],
  [1.5, 71],
  [3, 74],
  [4, 71],
  [5, 67],
  [5.5, 64],
  [7, 62],
] as const;

const RENDERS: Record<Source, Render> = {
  Drums(ctx, out) {
    for (const beat of [0, 2.5, 4, 6]) {
      const at = beat * BEAT;
      const kick = ctx.createOscillator();
      kick.frequency.setValueAtTime(140, at);
      kick.frequency.exponentialRampToValueAtTime(48, at + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      kick.connect(gain).connect(out);
      kick.start(at);
      kick.stop(at + 0.35);
    }
    for (const beat of [1, 3, 5, 7]) {
      const at = beat * BEAT;
      noise(ctx, out, { at, decay: 0.16, frequency: 1800, level: 0.6 });
      partial(ctx, out, { at, decay: 0.09, frequency: 190, level: 0.4 });
    }
    for (let eighth = 0; eighth < BEATS * 2; eighth += 1) {
      noise(ctx, out, {
        at: eighth * 0.5 * BEAT,
        decay: 0.04,
        frequency: 8000,
        level: eighth % 2 ? 0.08 : 0.16,
      });
    }
  },
  Keys(ctx, out) {
    for (const stab of STABS) {
      for (const [index, note] of stab.notes.entries()) {
        const at = stab.at * BEAT + index * 0.014;
        const base = hertz(note);
        partial(ctx, out, { at, decay: 0.7, frequency: base, level: 0.16 });
        partial(ctx, out, { at, decay: 0.3, frequency: base * 2, level: 0.06 });
        partial(ctx, out, {
          at,
          decay: 0.1,
          frequency: base * 4.01,
          level: 0.03,
        });
      }
    }
  },
  Pluck(ctx, out) {
    for (const [beat, note] of PLUCKS) {
      const at = beat * BEAT;
      partial(ctx, out, {
        at,
        decay: 0.45,
        frequency: hertz(note),
        level: 0.4,
        type: "triangle",
      });
      partial(ctx, out, {
        at,
        decay: 0.15,
        frequency: hertz(note) * 3,
        level: 0.1,
      });
    }
  },
};

/** Brings a buffer to the loops' shared loudness: the same average level, a sparse part as loud as a busy one, with no peak past `CEILING`. */
function normalize(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  let squares = 0;
  let peak = 0;
  for (const sample of data) {
    squares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(squares / data.length);
  if (rms === 0) {
    return buffer;
  }
  const gain = Math.min(TARGET_RMS / rms, CEILING / peak);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (data[i] ?? 0) * gain;
  }
  return buffer;
}

/** Renders one loop, as a decoded file would arrive. */
export async function renderLoop(source: Source) {
  const ctx = new OfflineAudioContext(1, Math.ceil(RATE * BEAT * BEATS), RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  RENDERS[source](ctx, out);
  return normalize(await ctx.startRendering());
}
