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

const sibilant = new Map<number, Promise<AudioBuffer>>();
const VOICE_HERTZ = 140;
const VOICE_LEVEL = 0.22;
const HISS_LEVEL = 0.5;
/** Where an "s" starts and how long it lasts, in beats: four to a loop, after the vowel. */
const HISS_BEATS = [1, 3, 5, 7];
const HISS_BEAT_LENGTH = 0.4;

/**
 * A voice for a de-esser: a held vowel (a sawtooth through two formants) with
 * a burst of high-passed noise, an "s", on each of four beats of the loop.
 */
export function renderSibilantLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = sibilant.get(sampleRate);
  if (cached) {
    return cached;
  }
  const length = Math.round(sampleRate * LOOP_SECONDS);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const voice = ctx.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.value = VOICE_HERTZ;
  const level = ctx.createGain();
  level.gain.value = VOICE_LEVEL;
  for (const formant of [700, 1200]) {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = formant;
    filter.Q.value = 4;
    voice.connect(filter).connect(level);
  }
  level.connect(ctx.destination);
  voice.start(0);

  const noise = ctx.createBuffer(1, length, sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  const highs = ctx.createBiquadFilter();
  highs.type = "highpass";
  highs.frequency.value = 5500;
  const burst = ctx.createGain();
  burst.gain.value = 0;
  for (const beat of HISS_BEATS) {
    const start = beat * BEAT_SECONDS;
    burst.gain.setValueAtTime(0, start);
    burst.gain.linearRampToValueAtTime(HISS_LEVEL, start + 0.02);
    burst.gain.setValueAtTime(
      HISS_LEVEL,
      start + HISS_BEAT_LENGTH * BEAT_SECONDS
    );
    burst.gain.linearRampToValueAtTime(
      0,
      start + (HISS_BEAT_LENGTH + 0.2) * BEAT_SECONDS
    );
  }
  hiss.connect(highs).connect(burst).connect(ctx.destination);
  hiss.start(0);

  const buffer = ctx.startRendering();
  sibilant.set(sampleRate, buffer);
  return buffer;
}

const wide = new Map<number, Promise<AudioBuffer>>();
const WIDE_LEFT_HERTZ = [220, 277.18, 329.63, 55];
const WIDE_RIGHT_HERTZ = [221.5, 275.9, 331.1, 55.4];
const WIDE_LEVEL = 0.07;

/**
 * The loop of `renderDemoLoop`, which sits in the centre, with a pad that is
 * wider than it: each channel has its own slightly detuned oscillators, and a
 * low note at 55 Hz is a little different in each, so there is bass in the
 * sides. What a mid/side device has something to move.
 */
export function renderWideLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = wide.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = renderDemoLoop(sampleRate).then((centre) => {
    const ctx = new OfflineAudioContext(2, centre.length, sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = centre;
    source.connect(ctx.destination);
    source.start(0);
    const merge = ctx.createChannelMerger(2);
    merge.connect(ctx.destination);
    for (const [channel, hertzList] of [
      [0, WIDE_LEFT_HERTZ],
      [1, WIDE_RIGHT_HERTZ],
    ] as const) {
      for (const hertz of hertzList) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = hertz < 100 ? "sine" : "sawtooth";
        oscillator.frequency.value = hertz;
        gain.gain.value = hertz < 100 ? WIDE_LEVEL * 3 : WIDE_LEVEL;
        oscillator.connect(gain).connect(merge, 0, channel);
        oscillator.start(0);
      }
    }
    return ctx.startRendering();
  });
  wide.set(sampleRate, buffer);
  return buffer;
}
