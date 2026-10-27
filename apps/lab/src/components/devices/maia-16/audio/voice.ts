/**
 * The voice Maia-16 speaks with when there is no microphone: two bars at 100
 * BPM made here by formant synthesis. A buzz (the vocal folds) goes through
 * three resonances (the throat and the mouth), and the resonances move from
 * vowel to vowel; consonants are bursts and hisses of noise. It says "Maia
 * sixteen", then sings oo, ah, ay-ee, oh. Rendered once into a buffer, as a
 * recording would arrive, and brought to the level of a voice on a microphone.
 */

const RATE = 44_100;
const BPM = 100;
const BEAT = 60 / BPM;
const BEATS = 8;
const TARGET_RMS = 10 ** (-20 / 20);
const CEILING = 0.9;

type Vowel = "a" | "e" | "i" | "o" | "u";
type Consonant = "k" | "m" | "n" | "s" | "t";

/** The first three formants of each vowel, in hertz, for an adult voice. */
const VOWELS: Record<Vowel, readonly [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};
/** A nasal (m, n): the mouth closed, the sound through the nose, low and muffled. */
const NASAL = [250, 1100, 2300] as const;
/** How wide each formant is, in hertz, and how loud next to the first. */
const WIDTHS = [90, 110, 150] as const;
const LEVELS = [1, 0.55, 0.3] as const;
/** How fast the mouth moves between shapes, as a time constant, in seconds. */
const ARTICULATION = 0.025;

interface Syllable {
  at: number;
  beats: number;
  coda?: readonly Consonant[];
  onset?: Consonant;
  /** Where the folds' pitch sits, in hertz. */
  pitch: number;
  /** A second vowel the first glides to, halfway through: a diphthong. */
  to?: Vowel;
  vowel: Vowel;
}

const PHRASE: readonly Syllable[] = [
  { at: 0, beats: 0.85, onset: "m", pitch: 132, to: "i", vowel: "a" },
  { at: 1, beats: 0.6, pitch: 118, vowel: "a" },
  { at: 2, beats: 0.55, coda: ["k", "s"], onset: "s", pitch: 140, vowel: "i" },
  { at: 3, beats: 0.85, coda: ["n"], onset: "t", pitch: 124, vowel: "i" },
  { at: 4, beats: 0.9, pitch: 110, vowel: "u" },
  { at: 5, beats: 0.9, pitch: 123, vowel: "a" },
  { at: 6, beats: 0.9, pitch: 138, to: "i", vowel: "e" },
  { at: 7, beats: 0.8, pitch: 110, vowel: "o" },
];

/** The noise each consonant is: a filter on it, how long it lasts and how loud. */
const NOISES: Partial<
  Record<
    Consonant,
    { decay: number; frequency: number; level: number; type: BiquadFilterType }
  >
> = {
  k: { decay: 0.03, frequency: 1800, level: 0.5, type: "bandpass" },
  s: { decay: 0.13, frequency: 5200, level: 0.35, type: "highpass" },
  t: { decay: 0.025, frequency: 3500, level: 0.6, type: "highpass" },
};

function hiss(
  ctx: OfflineAudioContext,
  out: AudioNode,
  at: number,
  consonant: Consonant
) {
  const noise = NOISES[consonant];
  if (!noise) {
    return 0;
  }
  const buffer = ctx.createBuffer(
    1,
    Math.ceil(RATE * (noise.decay + 0.03)),
    RATE
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = noise.type;
  filter.frequency.value = noise.frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(noise.level, at + 0.008);
  gain.gain.setTargetAtTime(0, at + noise.decay * 0.6, noise.decay / 4);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
  return noise.decay;
}

/** Brings the voice to a microphone's level, with no peak past the ceiling. */
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

/** Renders the phrase, as a recording would arrive. */
export async function renderVoice() {
  const ctx = new OfflineAudioContext(1, Math.ceil(RATE * BEAT * BEATS), RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);

  // The folds: a buzz, a little darker towards the top, gated by the syllables.
  const folds = ctx.createOscillator();
  folds.type = "sawtooth";
  folds.frequency.value = PHRASE[0]?.pitch ?? 120;
  const tilt = ctx.createBiquadFilter();
  tilt.type = "lowpass";
  tilt.frequency.value = 2800;
  const voicing = ctx.createGain();
  voicing.gain.value = 0;
  folds.connect(tilt).connect(voicing);

  // The mouth: three resonances side by side.
  const formants = WIDTHS.map((width, index) => {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    const first = VOWELS.a[index] ?? 500;
    filter.frequency.value = first;
    filter.Q.value = first / width;
    const level = ctx.createGain();
    level.gain.value = LEVELS[index] ?? 0;
    voicing.connect(filter).connect(level).connect(out);
    return filter;
  });
  const shape = (at: number, frequencies: readonly number[]) => {
    for (const [index, filter] of formants.entries()) {
      const frequency = frequencies[index] ?? 500;
      filter.frequency.setTargetAtTime(frequency, at, ARTICULATION);
      filter.Q.setTargetAtTime(
        frequency / (WIDTHS[index] ?? 100),
        at,
        ARTICULATION
      );
    }
  };

  for (const syllable of PHRASE) {
    let at = syllable.at * BEAT;
    const end = at + syllable.beats * BEAT;
    folds.frequency.setTargetAtTime(syllable.pitch, at, 0.04);
    if (syllable.onset === "m") {
      shape(at, NASAL);
      voicing.gain.setTargetAtTime(0.5, at, 0.01);
      at += 0.07;
    } else if (syllable.onset) {
      at += hiss(ctx, out, at, syllable.onset);
    }
    shape(at, VOWELS[syllable.vowel]);
    voicing.gain.setTargetAtTime(1, at, 0.012);
    if (syllable.to) {
      shape((at + end) / 2, VOWELS[syllable.to]);
    }
    let close = end;
    for (const consonant of syllable.coda ?? []) {
      if (consonant === "n") {
        shape(close - 0.08, NASAL);
        voicing.gain.setTargetAtTime(0.45, close - 0.08, 0.015);
        continue;
      }
      voicing.gain.setTargetAtTime(0, close - 0.04, 0.01);
      close += hiss(ctx, out, close - 0.03, consonant);
    }
    voicing.gain.setTargetAtTime(0, Math.min(close, end) - 0.03, 0.015);
  }
  folds.start();

  const buffer = await ctx.startRendering();
  normalize(buffer.getChannelData(0));
  return buffer;
}
