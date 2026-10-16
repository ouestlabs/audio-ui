import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";

const BPM = 100;
/** The tempo of the loop, for a device that follows it: a delay synced to it echoes on the beat. */
export const DEMO_TEMPO = { beatsPerBar: 4, beatUnit: 4, bpm: BPM };
const BEATS = 4;
const BEAT_SECONDS = 60 / BPM;
const LOOP_SECONDS = BEATS * BEAT_SECONDS;
const KICKS = [0, 2, 2.75];
const SNARES = [1, 3];
const HATS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
/** A short line on top: a beat, the pitch in hertz, so a delay or a reverb has notes to carry. */
const PLUCKS: [beat: number, hertz: number][] = [
  [0, 220],
  [0.75, 329.63],
  [1.5, 261.63],
  [2, 220],
  [2.75, 392],
  [3.5, 329.63],
];
const PLUCK_SECONDS = 0.45;
const PLUCK_LEVEL = 0.28;
const KICK_LEVEL = 0.9;
const SNARE_LEVEL = 0.5;
const HAT_LEVEL = 0.3;
const SILENCE_FLOOR = 0.001;

const rendered = new Map<number, Promise<AudioBuffer>>();

/** One short note: a triangle through a low-pass that closes as it dies, enough to carry an echo or a tail. */
function pluck(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertz: number
) {
  const oscillator = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(hertz, time);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4000, time);
  filter.frequency.exponentialRampToValueAtTime(500, time + PLUCK_SECONDS);
  gain.gain.setValueAtTime(PLUCK_LEVEL, time);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + PLUCK_SECONDS);
  oscillator.connect(filter).connect(gain).connect(destination);
  oscillator.start(time);
  oscillator.stop(time + PLUCK_SECONDS);
}

/**
 * A two-second loop to put an effect on: a kick and a snare, a hat on the
 * eighths and a short line of plucked notes, so there is a transient, a body
 * and a tail to hear what a delay, a reverb or a filter does. Drawn once per
 * sample rate by the drum voices of the library, then looped as a buffer.
 */
export function renderDemoLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = rendered.get(sampleRate);
  if (cached) {
    return cached;
  }
  const ctx = new OfflineAudioContext(
    2,
    Math.round(sampleRate * LOOP_SECONDS),
    sampleRate
  );
  const mix = ctx.createGain();
  mix.connect(ctx.destination);
  const at = (beat: number) => beat * BEAT_SECONDS;
  for (const beat of KICKS) {
    const hit = ctx.createGain();
    hit.gain.value = KICK_LEVEL;
    hit.connect(mix);
    triggerKick(ctx, hit, at(beat));
  }
  for (const beat of SNARES) {
    const hit = ctx.createGain();
    hit.gain.value = SNARE_LEVEL;
    hit.connect(mix);
    triggerSnare(ctx, hit, at(beat));
  }
  for (const beat of HATS) {
    const hit = ctx.createGain();
    hit.gain.value = HAT_LEVEL;
    hit.connect(mix);
    triggerHihat(ctx, hit, at(beat));
  }
  for (const [beat, hertz] of PLUCKS) {
    pluck(ctx, mix, at(beat), hertz);
  }
  const buffer = ctx.startRendering();
  rendered.set(sampleRate, buffer);
  return buffer;
}

const keyed = new Map<number, Promise<AudioBuffer>>();

/**
 * The kick of the loop on its own: the key a sidechain listens to, in step with
 * `renderDemoLoop` since both are drawn from the same beats.
 */
export function renderKickLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = keyed.get(sampleRate);
  if (cached) {
    return cached;
  }
  const ctx = new OfflineAudioContext(
    2,
    Math.round(sampleRate * LOOP_SECONDS),
    sampleRate
  );
  for (const beat of KICKS) {
    const hit = ctx.createGain();
    hit.gain.value = KICK_LEVEL;
    hit.connect(ctx.destination);
    triggerKick(ctx, hit, beat * BEAT_SECONDS);
  }
  const buffer = ctx.startRendering();
  keyed.set(sampleRate, buffer);
  return buffer;
}

const held = new Map<number, Promise<AudioBuffer>>();
/** An A minor chord, held for the whole loop: what a key has something to open. */
const CHORD_HERTZ = [110, 164.81, 220, 261.63];
const CHORD_LEVEL = 0.12;

/** A sustained chord for the length of the loop, a signal that is never quiet by itself. */
export function renderHeldChord(sampleRate: number): Promise<AudioBuffer> {
  const cached = held.get(sampleRate);
  if (cached) {
    return cached;
  }
  const ctx = new OfflineAudioContext(
    2,
    Math.round(sampleRate * LOOP_SECONDS),
    sampleRate
  );
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.connect(ctx.destination);
  for (const hertz of CHORD_HERTZ) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = hertz;
    gain.gain.value = CHORD_LEVEL;
    oscillator.connect(gain).connect(filter);
    oscillator.start(0);
  }
  const buffer = ctx.startRendering();
  held.set(sampleRate, buffer);
  return buffer;
}
