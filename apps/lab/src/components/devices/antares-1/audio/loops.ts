/**
 * The loops Antares-1 squeezes: three parts made here with oscillators and
 * noise, two bars at 100 BPM, with the dynamics a compressor has something to
 * do about (a kick that hits harder than the hats, a bass that swells). Each is
 * rendered once into a buffer, as a file would arrive, and brought to the same
 * average level without flattening what is in it.
 */

import type { Source } from "./engine";

const RATE = 44_100;
const BPM = 100;
const BEAT = 60 / BPM;
const BEATS = 8;
/** The average level of every loop, -20 dBFS, and the peak none passes. */
const TARGET_RMS = 10 ** (-20 / 20);
const CEILING = 0.95;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Render = (ctx: OfflineAudioContext, out: AudioNode) => void;

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

/** A kick: a sine that falls in pitch. */
function kick(
  ctx: OfflineAudioContext,
  out: AudioNode,
  at: number,
  level: number
) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(140, at);
  osc.frequency.exponentialRampToValueAtTime(48, at + 0.05);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.36);
}

const BASS = [33, 33, 36, 33, 40, 38, 36, 31];
const CHORDS = [
  { at: 0, notes: [57, 60, 64, 67] },
  { at: 2, notes: [53, 57, 60, 64] },
  { at: 4, notes: [50, 53, 57, 60] },
  { at: 6, notes: [52, 56, 59, 62] },
];

function bass(ctx: OfflineAudioContext, out: AudioNode, swell = 1) {
  for (const [beat, note] of BASS.entries()) {
    const at = beat * BEAT;
    // A bass that plays some notes much harder than the others.
    const level = (beat % 4 === 2 ? 0.95 : 0.4 + 0.1 * (beat % 3)) * swell;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.exponentialRampToValueAtTime(150, at + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + BEAT * 0.95);
    filter.connect(gain).connect(out);
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = hertz(note);
    saw.connect(filter);
    saw.start(at);
    saw.stop(at + BEAT);
  }
}

const RENDERS: Record<Source, Render> = {
  Bass(ctx, out) {
    bass(ctx, out);
  },
  Drums(ctx, out) {
    // A kick much louder than the rest, a snare, hats of two strengths.
    for (const beat of [0, 1.5, 2, 4, 5.5, 6]) {
      kick(ctx, out, beat * BEAT, 0.95);
    }
    for (const beat of [1, 3, 5, 7]) {
      const at = beat * BEAT;
      noise(ctx, out, { at, decay: 0.18, frequency: 1800, level: 0.5 });
      partial(ctx, out, { at, decay: 0.09, frequency: 190, level: 0.35 });
    }
    for (let eighth = 0; eighth < BEATS * 2; eighth += 1) {
      noise(ctx, out, {
        at: eighth * 0.5 * BEAT,
        decay: 0.04,
        frequency: 8000,
        level: eighth % 2 ? 0.06 : 0.14,
      });
    }
  },
  Mix(ctx, out) {
    for (let beat = 0; beat < BEATS; beat += 1) {
      kick(ctx, out, beat * BEAT, 0.8);
    }
    bass(ctx, out, 0.6);
    for (const chord of CHORDS) {
      for (const [index, note] of chord.notes.entries()) {
        const at = chord.at * BEAT + index * 0.014;
        const base = hertz(note);
        partial(ctx, out, { at, decay: 1.0, frequency: base, level: 0.12 });
        partial(ctx, out, { at, decay: 0.3, frequency: base * 2, level: 0.05 });
      }
    }
  },
};

/** Brings a buffer to the loops' shared average level, with no peak past the ceiling. */
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
