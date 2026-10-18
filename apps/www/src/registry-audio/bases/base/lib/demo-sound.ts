import type { Tempo } from "@audio-ui/core/time";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";

const BPM = 90;
/** The tempo of the loop, for a device that follows it: a delay synced to it echoes on the beat. */
export const DEMO_TEMPO = { beatsPerBar: 4, beatUnit: 4, bpm: BPM };
/** Two bars: the second answers the first on another chord. */
const BEATS = 8;
const BEAT_SECONDS = 60 / BPM;
const STEP_SECONDS = BEAT_SECONDS / 4;
const LOOP_SECONDS = BEATS * BEAT_SECONDS;
/** What rings past the end of the loop is mixed into its start, so no note is cut where the loop turns. */
const TAIL_SECONDS = 2;
/** How far the off-beat sixteenths are pushed back, as a share of a step: the lilt of the groove. */
const SWING = 0.18;
const SILENCE_FLOOR = 0.001;

/** A fixed run of numbers from 0 to 1, so the loop is the same each time it is drawn, and the kick of the key lands where the kick of the groove does. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d_2b_79_f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The moment of a sixteenth step, with the off-beat ones pushed back by the swing. */
const timeOf = (step: number) =>
  step * STEP_SECONDS + (step % 2 === 1 ? SWING * STEP_SECONDS : 0);

/** A hit: the step it falls on and how hard, 0 to 1. */
type Hit = [step: number, velocity: number];

const KICKS: Hit[] = [
  [0, 1],
  [7, 0.7],
  [10, 0.85],
  [16, 1],
  [22, 0.75],
  [25, 0.8],
  [29, 0.55],
];
/** The backbeat on two and four, and quiet ghost notes in front of it. */
const SNARES: Hit[] = [
  [4, 1],
  [12, 0.95],
  [20, 1],
  [28, 0.9],
  [15, 0.28],
  [23, 0.24],
  [31, 0.3],
];
/** Closed hats on the eighths, the ones on the beat harder, and ghost sixteenths between. */
const HATS: Hit[] = [
  ...Array.from(
    { length: 16 },
    (_, index): Hit => [index * 2, index % 2 === 0 ? 0.85 : 0.55]
  ),
  [3, 0.25],
  [11, 0.25],
  [19, 0.25],
  [27, 0.25],
].filter(([step]) => step !== 14 && step !== 30) as Hit[];
const OPEN_HATS: Hit[] = [
  [14, 0.5],
  [30, 0.5],
];
const KICK_LEVEL = 0.8;
const SNARE_LEVEL = 0.4;
const HAT_LEVEL = 0.4;
const HAT_PAN = 0.4;

/** The root of each bar, in hertz: A and F, low enough to be felt. */
const BASS_ROOTS_HZ = [55, 43.65];
/** A bass note: the step it starts on, how many steps it lasts, and the bar it belongs to. */
const BASS: [step: number, steps: number, bar: number][] = [
  [0, 3, 0],
  [7, 1.5, 0],
  [10, 3, 0],
  [16, 3, 1],
  [22, 1.5, 1],
  [25, 4, 1],
];
const BASS_LEVEL = 0.34;

/** A minor seventh, then an F major seventh: the two chords the bars play, voiced close, with their notes in hertz. */
const CHORDS_HZ = [
  [220, 261.63, 329.63, 392],
  [174.61, 220, 261.63, 329.63],
];
/** A chord struck, and where: the step, the chord, and how hard. The second strike of each bar comes back off the beat, softer. */
const KEYS: [step: number, chord: number, velocity: number][] = [
  [0, 0, 1],
  [6, 0, 0.6],
  [16, 1, 1],
  [22, 1, 0.6],
];
const KEY_LEVEL = 0.07;
const KEY_STRUM_SECONDS = 0.012;
const KEY_SPREAD = 0.6;

/** The line on top: the step, the pitch in hertz and how hard, so a delay or a reverb has notes to carry. */
const PLUCKS: [step: number, hertz: number, velocity: number][] = [
  [3, 659.25, 0.7],
  [9, 523.25, 0.5],
  [13, 587.33, 0.6],
  [19, 659.25, 0.65],
  [24, 783.99, 0.5],
  [27, 659.25, 0.4],
];
const PLUCK_SECONDS = 0.45;
const PLUCK_LEVEL = 0.2;
const PLUCK_PAN = 0.45;
/** The whole groove sits this far under full scale, at about the level the loop it replaces had. */
const GROOVE_TRIM = 0.8;

const rendered = new Map<number, Promise<AudioBuffer>>();

/** A gain for one hit, panned when it is not in the centre, into the mix. */
function bus(ctx: BaseAudioContext, mix: AudioNode, level: number, pan = 0) {
  const gain = ctx.createGain();
  gain.gain.value = level;
  if (pan === 0) {
    gain.connect(mix);
  } else {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner).connect(mix);
  }
  return gain;
}

/** One short note: a triangle through a low-pass that closes as it dies, enough to carry an echo or a tail. */
function pluck(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertz: number,
  level: number
) {
  const oscillator = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(hertz, time);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4000, time);
  filter.frequency.exponentialRampToValueAtTime(500, time + PLUCK_SECONDS);
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + PLUCK_SECONDS);
  oscillator.connect(filter).connect(gain).connect(destination);
  oscillator.start(time);
  oscillator.stop(time + PLUCK_SECONDS);
}

/** A bass note: a sine for the weight and a triangle an octave up for the body, so it is heard on a small speaker too. */
function bassNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertz: number,
  seconds: number
) {
  const sub = ctx.createOscillator();
  const body = ctx.createOscillator();
  const bodyLevel = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  sub.type = "sine";
  sub.frequency.value = hertz;
  body.type = "triangle";
  body.frequency.value = hertz * 2;
  bodyLevel.gain.value = 0.35;
  filter.type = "lowpass";
  filter.frequency.value = 400;
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(BASS_LEVEL, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(
    BASS_LEVEL * 0.55,
    time + seconds * 0.6
  );
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds + 0.08);
  sub.connect(gain);
  body.connect(bodyLevel).connect(filter).connect(gain);
  gain.connect(destination);
  for (const oscillator of [sub, body]) {
    oscillator.start(time);
    oscillator.stop(time + seconds + 0.1);
  }
}

/** A key of an electric piano: the note, a softer octave that dies sooner for the tine, and a twin a few cents sharp on the other side, whose beating moves the sound between the ears. */
function key(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertz: number,
  level: number,
  pan: number
) {
  const partials: [
    ratio: number,
    share: number,
    seconds: number,
    side: number,
  ][] = [
    [1, 1, 1.6, pan],
    [1.0029, 0.5, 1.6, pan >= 0 ? -0.5 : 0.5],
    [2, 0.4, 0.5, pan],
    [3, 0.12, 0.25, pan],
  ];
  for (const [ratio, share, seconds, side] of partials) {
    const tone = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    panner.pan.value = side;
    oscillator.type = "sine";
    oscillator.frequency.value = hertz * ratio;
    gain.gain.setValueAtTime(SILENCE_FLOOR, time);
    gain.gain.linearRampToValueAtTime(level * share, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
    oscillator.connect(gain).connect(tone).connect(panner).connect(destination);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }
}

/** The kicks of the groove: the same each time, for the loop and for the key that follows it. */
function drawKicks(ctx: BaseAudioContext, mix: AudioNode) {
  const random = seededRandom(11);
  for (const [step, velocity] of KICKS) {
    const time = Math.max(0, timeOf(step) + (random() - 0.5) * 0.006);
    triggerKick(ctx, bus(ctx, mix, KICK_LEVEL * velocity), time, {
      decay: 0.3,
      tune: -1,
    });
  }
}

/** What the drums, the bass, the keys and the line play, over two bars. */
function drawGroove(ctx: BaseAudioContext, out: AudioNode) {
  const random = seededRandom(23);
  const mix = ctx.createGain();
  mix.gain.value = GROOVE_TRIM;
  mix.connect(out);
  drawKicks(ctx, mix);
  for (const [step, velocity] of SNARES) {
    const time = timeOf(step) + (random() - 0.5) * 0.006;
    triggerSnare(ctx, bus(ctx, mix, SNARE_LEVEL * velocity), time);
  }
  for (const [step, velocity] of HATS) {
    const time = timeOf(step) + (random() - 0.5) * 0.012;
    const level = HAT_LEVEL * velocity * (0.9 + 0.2 * random());
    triggerHihat(ctx, bus(ctx, mix, level, HAT_PAN), time);
  }
  for (const [step, velocity] of OPEN_HATS) {
    triggerHihat(
      ctx,
      bus(ctx, mix, HAT_LEVEL * velocity, HAT_PAN),
      timeOf(step),
      { decay: 0.3 }
    );
  }
  for (const [step, steps, bar] of BASS) {
    bassNote(
      ctx,
      mix,
      timeOf(step),
      BASS_ROOTS_HZ[bar] ?? 55,
      steps * STEP_SECONDS
    );
  }
  for (const [step, chord, velocity] of KEYS) {
    const notes = CHORDS_HZ[chord] ?? [];
    notes.forEach((hertz, index) => {
      const pan =
        (index / Math.max(1, notes.length - 1) - 0.5) * 2 * KEY_SPREAD;
      key(
        ctx,
        mix,
        timeOf(step) + index * KEY_STRUM_SECONDS,
        hertz,
        KEY_LEVEL * velocity,
        pan
      );
    });
  }
  PLUCKS.forEach(([step, hertz, velocity], index) => {
    const line = bus(ctx, mix, 1, index % 2 === 0 ? -PLUCK_PAN : PLUCK_PAN);
    pluck(ctx, line, timeOf(step), hertz, PLUCK_LEVEL * velocity);
  });
}

/** Draws a loop of `seconds`, then folds what rings past its end into its start. */
async function drawLoop(
  sampleRate: number,
  seconds: number,
  draw: (ctx: BaseAudioContext, mix: AudioNode) => void
) {
  const loop = Math.round(sampleRate * seconds);
  const ctx = new OfflineAudioContext(
    2,
    loop + Math.round(sampleRate * TAIL_SECONDS),
    sampleRate
  );
  const mix = ctx.createGain();
  mix.connect(ctx.destination);
  draw(ctx, mix);
  const drawn = await ctx.startRendering();
  const folded = new AudioBuffer({
    length: loop,
    numberOfChannels: 2,
    sampleRate,
  });
  for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
    const from = drawn.getChannelData(channelIndex);
    const to = folded.getChannelData(channelIndex);
    for (let index = 0; index < loop; index += 1) {
      to[index] = (from[index] ?? 0) + (from[loop + index] ?? 0);
    }
  }
  return folded;
}

/**
 * A two-bar groove to put an effect on, at 90 BPM with a lilt: a kick and a
 * snare with ghost notes, hats that are not all the same, a bass, an electric
 * piano on two chords and a line of plucked notes on top, so there is a
 * transient, a body and a tail to hear what a delay, a reverb or a filter does.
 * Drawn once per sample rate by the drum voices of the library, then looped as
 * a buffer.
 */
export function renderDemoLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = rendered.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, LOOP_SECONDS, drawGroove);
  rendered.set(sampleRate, buffer);
  return buffer;
}

const keyed = new Map<number, Promise<AudioBuffer>>();

/**
 * The kick of the groove on its own: the key a sidechain listens to, in step
 * with `renderDemoLoop` since both are drawn from the same beats.
 */
export function renderKickLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = keyed.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, LOOP_SECONDS, drawKicks);
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
        gain.gain.value = hertz < 100 ? WIDE_LEVEL * 1.5 : WIDE_LEVEL;
        oscillator.connect(gain).connect(merge, 0, channel);
        oscillator.start(0);
      }
    }
    return ctx.startRendering();
  });
  wide.set(sampleRate, buffer);
  return buffer;
}

/*
 * Two signals made of noise, which a ctx can draw at once, and the catalogue
 * that names every sound a preview plays.
 */

const NOISE_SECONDS = 4;

/** Pink noise: equal energy per octave, so a flat equalizer looks flat. Paul Kellet's filter. */
export function pinkNoise(
  ctx: BaseAudioContext,
  seconds = NOISE_SECONDS
): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.998_86 * b0 + white * 0.055_517_9;
    b1 = 0.993_32 * b1 + white * 0.075_075_9;
    b2 = 0.969 * b2 + white * 0.153_852;
    b3 = 0.8665 * b3 + white * 0.310_485_6;
    b4 = 0.55 * b4 + white * 0.532_952_2;
    b5 = -0.7616 * b5 - white * 0.016_898;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115_926;
  }
  return buffer;
}

const PULSE_LOOP_SECONDS = 2;
const PULSES_PER_LOOP = 8;
const PULSE_DECAY_SECONDS = 0.18;
/** Every other pulse is quieter, so a level that follows them moves along a curve. */
const QUIET_PULSE = 0.35;

/** Noise bursts that start loud and fade, eight to a loop, every other one quieter. `level` scales the loudest. */
export function pulses(ctx: BaseAudioContext, level = 1): AudioBuffer {
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * PULSE_LOOP_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  const pulseLength = data.length / PULSES_PER_LOOP;
  for (let index = 0; index < data.length; index += 1) {
    const seconds = (index % pulseLength) / ctx.sampleRate;
    const accent = Math.floor(index / pulseLength) % 2 === 0 ? 1 : QUIET_PULSE;
    data[index] =
      (Math.random() * 2 - 1) *
      accent *
      level *
      Math.exp(-seconds / PULSE_DECAY_SECONDS);
  }
  return buffer;
}

/*
 * The hip-hop scene: DMV hip-hop at 140 BPM, built on the go-go pocket. The
 * hats swing toward a triplet, the kick and the snare play the syncopated
 * pattern of go-go, congas and a cowbell sit over it, and an 808 follows the
 * kick. Over it a haunting piano in F minor, its notes a semitone apart for
 * the tension, a few ambient bells and a slow pad, with room left between
 * them.
 */

const HIPHOP_BPM = 140;
/** The tempo of the hip-hop scene: what a delay synced to it echoes on. */
export const HIPHOP_TEMPO: Tempo = {
  beatsPerBar: 4,
  beatUnit: 4,
  bpm: HIPHOP_BPM,
};
const HIPHOP_STEP_SECONDS = 60 / HIPHOP_BPM / 4;
const HIPHOP_LOOP_SECONDS = (8 * 60) / HIPHOP_BPM;
const HIPHOP_TRIM = 0.4;
/** How far the off-beat sixteenths are pushed back, as a share of a step: a third is a triplet, which is where go-go puts its hats. */
const HIPHOP_SWING = 0.28;

/** The moment of a sixteenth step of the hip-hop scene, with the off-beat whole steps pushed back by the swing. */
const hiphopTimeOf = (step: number) =>
  step * HIPHOP_STEP_SECONDS +
  (Number.isInteger(step) && step % 2 === 1
    ? HIPHOP_SWING * HIPHOP_STEP_SECONDS
    : 0);

/** The go-go pocket: the kick on the one, just after it, and where the 808 will move. The second bar leans into the turn. */
const HIPHOP_KICKS: Hit[] = [
  [0, 1],
  [3, 0.6],
  [6, 0.8],
  [10, 0.9],
  [13, 0.6],
  [16, 1],
  [19, 0.6],
  [22, 0.8],
  [26, 0.9],
  [30, 0.6],
];
/** The snare is dry and the clap on top of it loud, on the second and fourth beats. */
const HIPHOP_CRACKS: Hit[] = [
  [4, 1],
  [12, 0.95],
  [20, 1],
  [28, 0.95],
];
/** A hat: where it falls (a fraction of a step for a roll), how hard, and how far up in semitones. */
type HipHopHat = [step: number, velocity: number, tune: number];
/** One bar of hats, which swing toward a triplet: the ticking of go-go. The steps are the ones of the first bar. */
const HIPHOP_HAT_BAR: [step: number, velocity: number][] = [
  [0, 0.8],
  [2, 0.55],
  [3, 0.4],
  [5, 0.4],
  [6, 0.55],
  [8, 0.75],
  [9, 0.4],
  [11, 0.4],
  [12, 0.7],
  [15, 0.45],
];
const HIPHOP_HATS: HipHopHat[] = [
  ...HIPHOP_HAT_BAR.map(([step, velocity]): HipHopHat => [step, velocity, 0]),
  ...HIPHOP_HAT_BAR.map(
    ([step, velocity]): HipHopHat => [step + 16, velocity, 0]
  ),
  // The first bar ends on a triplet roll, each hit harder and higher than the last, and the second on two plain hats.
  [14, 0.35, 0],
  [14 + 1 / 3, 0.5, 1],
  [14 + 2 / 3, 0.7, 2],
  [30, 0.5, 0],
];
const HIPHOP_OPEN_HATS: Hit[] = [
  [7, 0.5],
  [23, 0.45],
];
const HIPHOP_KICK_LEVEL = 0.75;
const HIPHOP_CLAP_LEVEL = 0.45;
const HIPHOP_SNARE_LEVEL = 0.4;
const HIPHOP_HAT_LEVEL = 0.65;
const HIPHOP_HAT_PAN = 0.35;

/** An 808: where it starts, how many steps it lasts, the pitch it starts on and the pitch it settles on, in hertz. */
const HIPHOP_808: [step: number, steps: number, from: number, to: number][] = [
  [0, 6, 43.65, 43.65],
  [6, 4, 51.91, 43.65],
  [10, 6, 69.3, 69.3],
  [16, 6, 43.65, 43.65],
  [22, 4, 51.91, 43.65],
  [26, 6, 65.41, 43.65],
];
const HIPHOP_808_LEVEL = 0.5;

/** The piano's line, in F minor: the step, the pitch in hertz and how hard. Notes a semitone apart, E against F, B flat against C, are what makes it uneasy. */
const HIPHOP_PIANO: [step: number, hertz: number, velocity: number][] = [
  [0, 349.23, 0.8],
  [4, 329.63, 0.55],
  [6, 349.23, 0.7],
  [10, 415.3, 0.6],
  [16, 523.25, 0.75],
  [20, 466.16, 0.5],
  [22, 523.25, 0.65],
  [26, 554.37, 0.6],
];
/** The first note of each bar again an octave down, to darken it. */
const HIPHOP_PIANO_LOW: [step: number, hertz: number, velocity: number][] = [
  [0, 174.61, 0.6],
  [16, 261.63, 0.6],
];
const HIPHOP_PIANO_LEVEL = 0.09;
const HIPHOP_PIANO_PAN = 0.2;

/** A few high bells, far off: the step, the pitch in hertz and how hard. */
const HIPHOP_BELLS: [step: number, hertz: number, velocity: number][] = [
  [8, 1396.91, 0.6],
  [14, 1046.5, 0.5],
  [24, 1108.73, 0.6],
];
const HIPHOP_BELL_LEVEL = 0.035;
const HIPHOP_BELL_PAN = 0.5;

/** The pad of each bar, in hertz: F minor, then D flat major. */
const HIPHOP_PAD_HZ = [
  [174.61, 207.65, 261.63],
  [138.59, 174.61, 207.65],
];
const HIPHOP_PAD_LEVEL = 0.03;

/** The congas of the go-go, a step apart three at a time, against the four of the beat: the step, how hard and which side. */
const HIPHOP_CONGAS: [step: number, velocity: number, pan: number][] = [
  [2, 0.5, -0.4],
  [5, 0.35, 0.4],
  [8, 0.45, -0.4],
  [11, 0.4, 0.4],
  [14, 0.5, -0.4],
  [18, 0.5, -0.4],
  [21, 0.35, 0.4],
  [24, 0.45, -0.4],
  [27, 0.4, 0.4],
  [30, 0.5, -0.4],
];
const HIPHOP_COWBELLS: Hit[] = [
  [3, 0.5],
  [7, 0.4],
  [11, 0.5],
  [15, 0.4],
  [19, 0.5],
  [23, 0.4],
  [27, 0.5],
  [31, 0.4],
];
const HIPHOP_PERCUSSION_LEVEL = 0.2;

/** A clip of a given drive: it gives a sine harmonics a small speaker can play, and makes a saw bite. */
function clipCurve(drive: number) {
  const curve = new Float32Array(2048);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
const DRIVEN_CLIP = clipCurve(8);

/**
 * An 808: a sine that starts on `from` and slides to `to` in a tenth of a
 * second. It goes two ways: a clean sub, low-passed so nothing above it is in
 * the way, and the same note driven hard and high-passed, which is the bite.
 */
function sub808(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  from: number,
  to: number,
  seconds: number
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const sub = ctx.createBiquadFilter();
  const clip = ctx.createWaveShaper();
  const bite = ctx.createBiquadFilter();
  const top = ctx.createBiquadFilter();
  const biteLevel = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, time);
  if (from !== to) {
    oscillator.frequency.exponentialRampToValueAtTime(to, time + 0.1);
  }
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(HIPHOP_808_LEVEL, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(HIPHOP_808_LEVEL * 0.5, time + 0.4);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
  sub.type = "lowpass";
  sub.frequency.value = 160;
  clip.curve = DRIVEN_CLIP;
  bite.type = "highpass";
  bite.frequency.value = 110;
  top.type = "lowpass";
  top.frequency.value = 5000;
  biteLevel.gain.value = 0.35;
  oscillator.connect(gain);
  gain.connect(sub).connect(destination);
  gain
    .connect(clip)
    .connect(bite)
    .connect(top)
    .connect(biteLevel)
    .connect(destination);
  oscillator.start(time);
  oscillator.stop(time + seconds + 0.05);
}

/** Noise from a fixed sequence, so a clap or a click is the same each time. */
function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number) {
  const random = seededRandom(seed);
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = random() * 2 - 1;
  }
  return buffer;
}

/** A clap: four short bursts of band-passed noise a hair apart, the last one longer, which is what makes it a hand and not a snare. */
function clap(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number
) {
  const burstSeconds = 0.012;
  for (const index of [0, 1, 2, 3]) {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const start = time + index * burstSeconds;
    const decay = index === 3 ? 0.14 : 0.03;
    source.buffer = noiseBuffer(ctx, decay + 0.05, 50 + index);
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 1.2;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, start + decay);
    source.connect(filter).connect(gain).connect(destination);
    source.start(start);
    source.stop(start + decay + 0.05);
  }
}

/** A conga: a sine that falls fast from 330 Hz to 240 Hz, with a short click of noise at the strike. */
function conga(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(330, time);
  oscillator.frequency.exponentialRampToValueAtTime(240, time + 0.06);
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.16);
  oscillator.connect(gain).connect(destination);
  oscillator.start(time);
  oscillator.stop(time + 0.18);
  const click = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const clickGain = ctx.createGain();
  click.buffer = noiseBuffer(ctx, 0.04, 71);
  filter.type = "bandpass";
  filter.frequency.value = 2000;
  clickGain.gain.setValueAtTime(level * 0.5, time);
  clickGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.02);
  click.connect(filter).connect(clickGain).connect(destination);
  click.start(time);
  click.stop(time + 0.04);
}

/** A cowbell: two squares a fifth apart through a band-pass, which ring and stop short. */
function cowbell(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number
) {
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "bandpass";
  filter.frequency.value = 810;
  filter.Q.value = 2;
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(level, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.2);
  filter.connect(gain).connect(destination);
  for (const hertz of [540, 800]) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = hertz;
    oscillator.connect(filter);
    oscillator.start(time);
    oscillator.stop(time + 0.22);
  }
}

/** A bell: a sine with two inharmonic partials above it, which die faster, so it rings rather than sings. */
function bell(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertz: number,
  level: number,
  pan: number
) {
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(destination);
  const partials: [ratio: number, share: number, seconds: number][] = [
    [1, 1, 1.4],
    [2.76, 0.35, 0.5],
    [5.4, 0.12, 0.2],
  ];
  for (const [ratio, share, seconds] of partials) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = hertz * ratio;
    gain.gain.setValueAtTime(level * share, time);
    gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
    oscillator.connect(gain).connect(panner);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }
}

/** A piano note, dark: a few sine partials, each a touch sharp of its harmonic as a string is, the higher ones dying faster, a soft click of felt at the strike, through a low-pass that takes the brightness off. */
function pianoNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertz: number,
  level: number,
  pan: number
) {
  const tone = ctx.createBiquadFilter();
  const panner = ctx.createStereoPanner();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  panner.pan.value = pan;
  tone.connect(panner).connect(destination);
  const partials: [ratio: number, share: number, seconds: number][] = [
    [1, 1, 2.2],
    [2, 0.5, 1.4],
    [3, 0.28, 0.9],
    [4, 0.14, 0.6],
    [5, 0.07, 0.4],
  ];
  for (const [ratio, share, seconds] of partials) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = hertz * ratio * (1 + 0.0004 * ratio * ratio);
    gain.gain.setValueAtTime(SILENCE_FLOOR, time);
    gain.gain.linearRampToValueAtTime(level * share, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
    oscillator.connect(gain).connect(tone);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }
  const felt = ctx.createBufferSource();
  const feltFilter = ctx.createBiquadFilter();
  const feltGain = ctx.createGain();
  felt.buffer = noiseBuffer(ctx, 0.03, 90);
  feltFilter.type = "bandpass";
  feltFilter.frequency.value = 1800;
  feltGain.gain.setValueAtTime(level * 0.15, time);
  feltGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.012);
  felt.connect(feltFilter).connect(feltGain).connect(tone);
  felt.start(time);
  felt.stop(time + 0.03);
}

/** A pad: each note of the chord twice, a few cents apart, one on each side, as saws through a low-pass that keeps only the dark. It swells in slowly and lets go before the next. */
function padChord(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  hertzList: number[],
  seconds: number,
  level: number
) {
  const tone = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  tone.type = "lowpass";
  tone.frequency.value = 650;
  tone.Q.value = 0.7;
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(level, time + 0.8);
  gain.gain.setValueAtTime(level, time + seconds - 0.8);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
  gain.connect(tone).connect(destination);
  for (const hertz of hertzList) {
    for (const [cents, pan] of [
      [-9, -0.6],
      [9, 0.6],
    ] as const) {
      const oscillator = ctx.createOscillator();
      const panner = ctx.createStereoPanner();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = hertz;
      oscillator.detune.value = cents;
      panner.pan.value = pan;
      oscillator.connect(panner).connect(gain);
      oscillator.start(time);
      oscillator.stop(time + seconds);
    }
  }
}

/** The kicks of the hip-hop scene: the same each time, for the loop and for the key that follows it. */
function drawHipHopKicks(ctx: BaseAudioContext, mix: AudioNode) {
  const random = seededRandom(31);
  for (const [step, velocity] of HIPHOP_KICKS) {
    const time = Math.max(0, hiphopTimeOf(step) + (random() - 0.5) * 0.004);
    triggerKick(ctx, bus(ctx, mix, HIPHOP_KICK_LEVEL * velocity), time, {
      decay: 0.18,
      tune: 2,
    });
  }
}

/** What the drums, the 808, the piano, the bells and the pad play, over two bars. */
function drawHipHop(ctx: BaseAudioContext, out: AudioNode) {
  const random = seededRandom(37);
  const mix = ctx.createGain();
  mix.gain.value = HIPHOP_TRIM;
  mix.connect(out);
  drawHipHopKicks(ctx, mix);
  for (const [step, velocity] of HIPHOP_CRACKS) {
    const time = hiphopTimeOf(step);
    triggerSnare(ctx, bus(ctx, mix, HIPHOP_SNARE_LEVEL * velocity), time, {
      tune: 1,
    });
    clap(ctx, mix, time, HIPHOP_CLAP_LEVEL * velocity);
  }
  for (const [step, velocity, tune] of HIPHOP_HATS) {
    const time = hiphopTimeOf(step) + (random() - 0.5) * 0.006;
    const level = HIPHOP_HAT_LEVEL * velocity * (0.9 + 0.2 * random());
    triggerHihat(ctx, bus(ctx, mix, level, HIPHOP_HAT_PAN), time, {
      decay: 0.04,
      tune,
    });
  }
  for (const [step, velocity] of HIPHOP_OPEN_HATS) {
    triggerHihat(
      ctx,
      bus(ctx, mix, HIPHOP_HAT_LEVEL * velocity, HIPHOP_HAT_PAN),
      hiphopTimeOf(step),
      { decay: 0.25 }
    );
  }
  for (const [step, steps, from, to] of HIPHOP_808) {
    sub808(
      ctx,
      mix,
      hiphopTimeOf(step),
      from,
      to,
      steps * HIPHOP_STEP_SECONDS + 0.15
    );
  }
  for (const [step, velocity, pan] of HIPHOP_CONGAS) {
    conga(
      ctx,
      bus(ctx, mix, 1, pan),
      hiphopTimeOf(step),
      HIPHOP_PERCUSSION_LEVEL * velocity
    );
  }
  for (const [step, velocity] of HIPHOP_COWBELLS) {
    cowbell(
      ctx,
      mix,
      hiphopTimeOf(step),
      HIPHOP_PERCUSSION_LEVEL * 0.4 * velocity
    );
  }
  HIPHOP_PIANO.forEach(([step, hertz, velocity], index) => {
    pianoNote(
      ctx,
      mix,
      hiphopTimeOf(step),
      hertz,
      HIPHOP_PIANO_LEVEL * velocity,
      index % 2 === 0 ? -HIPHOP_PIANO_PAN : HIPHOP_PIANO_PAN
    );
  });
  for (const [step, hertz, velocity] of HIPHOP_PIANO_LOW) {
    pianoNote(
      ctx,
      mix,
      hiphopTimeOf(step),
      hertz,
      HIPHOP_PIANO_LEVEL * velocity,
      0
    );
  }
  HIPHOP_BELLS.forEach(([step, hertz, velocity], index) => {
    bell(
      ctx,
      mix,
      hiphopTimeOf(step),
      hertz,
      HIPHOP_BELL_LEVEL * velocity,
      index % 2 === 0 ? -HIPHOP_BELL_PAN : HIPHOP_BELL_PAN
    );
  });
  HIPHOP_PAD_HZ.forEach((chord, bar) => {
    padChord(
      ctx,
      mix,
      hiphopTimeOf(bar * 16),
      chord,
      16 * HIPHOP_STEP_SECONDS + 0.8,
      HIPHOP_PAD_LEVEL
    );
  });
}

const hiphopped = new Map<number, Promise<AudioBuffer>>();

/**
 * DMV hip-hop at 140 BPM, two bars, on the go-go pocket: hats that swing toward
 * a triplet, a kick and a dry snare with a loud clap in the syncopated pattern
 * of go-go, congas and a cowbell over it, an 808 that follows the kick, a
 * haunting piano in F minor with notes a semitone apart, a few ambient bells
 * and a slow pad. Weight in the low end and plenty on top, to hear what a
 * filter, a limiter or a saturator does.
 */
export function renderHipHopLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = hiphopped.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, HIPHOP_LOOP_SECONDS, drawHipHop);
  hiphopped.set(sampleRate, buffer);
  return buffer;
}

const hiphopKeyed = new Map<number, Promise<AudioBuffer>>();

/** The kick of the hip-hop scene on its own: the key a sidechain listens to, in step with `renderHipHopLoop`. */
export function renderHipHopKick(sampleRate: number): Promise<AudioBuffer> {
  const cached = hiphopKeyed.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, HIPHOP_LOOP_SECONDS, drawHipHopKicks);
  hiphopKeyed.set(sampleRate, buffer);
  return buffer;
}

/*
 * The crank scene: DMV crank at 150 BPM, dry and fast. Straight on the grid,
 * with almost nothing between the beats: a kick and an 808 that are few, a
 * clap loud on a dry snare on the third beat of each bar, hats that tick on
 * every sixteenth with hardly any change, and a cowbell on the off-beats that
 * clashes with them. A short line of bells is all the tune there is.
 */

const CRANK_BPM = 150;
/** The tempo of the crank scene: what a delay synced to it echoes on. */
export const CRANK_TEMPO: Tempo = {
  beatsPerBar: 4,
  beatUnit: 4,
  bpm: CRANK_BPM,
};
const CRANK_STEP_SECONDS = 60 / CRANK_BPM / 4;
const CRANK_LOOP_SECONDS = (8 * 60) / CRANK_BPM;
const CRANK_TRIM = 0.4;

/** The moment of a sixteenth step of the crank scene: straight, so the ticking stays tight. */
const crankTimeOf = (step: number) => step * CRANK_STEP_SECONDS;

const CRANK_KICKS: Hit[] = [
  [0, 1],
  [10, 0.9],
  [16, 1],
  [26, 0.9],
];
/** The dry snare and the loud clap land together on the third beat of each bar. */
const CRANK_CRACKS: Hit[] = [
  [8, 1],
  [24, 1],
];
/** Every sixteenth, the one on a beat only a little harder: it ticks. */
const CRANK_HATS: Hit[] = Array.from(
  { length: 32 },
  (_, step): Hit => [step, step % 4 === 0 ? 0.62 : 0.52]
);
/** The cowbell on every off-beat eighth. */
const CRANK_COWBELLS: Hit[] = [3, 7, 11, 15, 19, 23, 27, 31].map(
  (step): Hit => [step, 0.8]
);
/** The 808 on the kick, a note to each. */
const CRANK_808: [step: number, steps: number, from: number, to: number][] = [
  [0, 9, 43.65, 43.65],
  [10, 6, 69.3, 43.65],
  [16, 9, 43.65, 43.65],
  [26, 6, 65.41, 43.65],
];
/** The only tune: a line of bells in F minor, a semitone apart in places, the second bar a fourth higher. */
const CRANK_BELLS: [step: number, hertz: number, velocity: number][] = [
  [2, 698.46, 0.7],
  [6, 659.25, 0.5],
  [12, 698.46, 0.6],
  [14, 830.61, 0.6],
  [18, 1046.5, 0.7],
  [22, 932.33, 0.5],
  [28, 1046.5, 0.6],
  [30, 1108.73, 0.6],
];
const CRANK_KICK_LEVEL = 0.8;
const CRANK_CLAP_LEVEL = 0.6;
const CRANK_SNARE_LEVEL = 0.45;
const CRANK_HAT_LEVEL = 0.55;
const CRANK_COWBELL_LEVEL = 0.18;
const CRANK_BELL_LEVEL = 0.07;
const CRANK_BELL_PAN = 0.35;

/** The kicks of the crank scene: the same each time, for the loop and for the key that follows it. */
function drawCrankKicks(ctx: BaseAudioContext, mix: AudioNode) {
  const random = seededRandom(41);
  for (const [step, velocity] of CRANK_KICKS) {
    const time = Math.max(0, crankTimeOf(step) + (random() - 0.5) * 0.002);
    triggerKick(ctx, bus(ctx, mix, CRANK_KICK_LEVEL * velocity), time, {
      decay: 0.12,
      tune: 3,
    });
  }
}

/** What the drums, the cowbell, the 808 and the bells play, over two bars. */
function drawCrank(ctx: BaseAudioContext, out: AudioNode) {
  const random = seededRandom(43);
  const mix = ctx.createGain();
  mix.gain.value = CRANK_TRIM;
  mix.connect(out);
  drawCrankKicks(ctx, mix);
  for (const [step, velocity] of CRANK_CRACKS) {
    const time = crankTimeOf(step);
    triggerSnare(ctx, bus(ctx, mix, CRANK_SNARE_LEVEL * velocity), time, {
      tune: 2,
    });
    clap(ctx, mix, time, CRANK_CLAP_LEVEL * velocity);
  }
  for (const [step, velocity] of CRANK_HATS) {
    const time = crankTimeOf(step) + (random() - 0.5) * 0.003;
    const level = CRANK_HAT_LEVEL * velocity * (0.95 + 0.1 * random());
    triggerHihat(ctx, bus(ctx, mix, level, 0.3), time, { decay: 0.03 });
  }
  for (const [step, velocity] of CRANK_COWBELLS) {
    cowbell(ctx, mix, crankTimeOf(step), CRANK_COWBELL_LEVEL * velocity);
  }
  for (const [step, steps, from, to] of CRANK_808) {
    sub808(
      ctx,
      mix,
      crankTimeOf(step),
      from,
      to,
      steps * CRANK_STEP_SECONDS + 0.1
    );
  }
  CRANK_BELLS.forEach(([step, hertz, velocity], index) => {
    bell(
      ctx,
      mix,
      crankTimeOf(step),
      hertz,
      CRANK_BELL_LEVEL * velocity,
      index % 2 === 0 ? -CRANK_BELL_PAN : CRANK_BELL_PAN
    );
  });
}

const cranked = new Map<number, Promise<AudioBuffer>>();

/**
 * DMV crank at 150 BPM, two bars, dry and fast: a few kicks with an 808 on
 * each, a loud clap on a dry snare on the third beat, hats that tick on every
 * sixteenth, a cowbell on the off-beats and a short line of bells. To hear what
 * a filter, a limiter or a saturator does to something hard and tight.
 */
export function renderCrankLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = cranked.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, CRANK_LOOP_SECONDS, drawCrank);
  cranked.set(sampleRate, buffer);
  return buffer;
}

const crankKeyed = new Map<number, Promise<AudioBuffer>>();

/** The kick of the crank scene on its own: the key a sidechain listens to, in step with `renderCrankLoop`. */
export function renderCrankKick(sampleRate: number): Promise<AudioBuffer> {
  const cached = crankKeyed.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, CRANK_LOOP_SECONDS, drawCrankKicks);
  crankKeyed.set(sampleRate, buffer);
  return buffer;
}

/** A sound a preview can play: what it is called, what it is for, and how it is drawn for a sample rate. */
export interface DemoSource {
  /** What to listen for, in a sentence. */
  about: string;
  /** For a sound that is a key, not a sound to listen through: a gate or a ducker follows it. */
  isKey?: boolean;
  /** The name of the key that goes with the sound, when it is not `"kick"`: the one drawn on the same beats. */
  key?: string;
  render: (sampleRate: number) => Promise<AudioBuffer>;
  /** The tempo a device that follows one is read against, when the sound has its own. @default DEMO_TEMPO */
  tempo?: Tempo;
  title: string;
}

const drawn = (draw: (ctx: BaseAudioContext) => AudioBuffer) => {
  const cache = new Map<number, Promise<AudioBuffer>>();
  return (sampleRate: number) => {
    const cached = cache.get(sampleRate);
    if (cached) {
      return cached;
    }
    const buffer = Promise.resolve(
      draw(new OfflineAudioContext(1, 1, sampleRate))
    );
    cache.set(sampleRate, buffer);
    return buffer;
  };
};

/**
 * Every sound of the library's previews, by name: the one place to find what a
 * preview plays and how it is made. A device takes the one that shows what it
 * does: a delay a loop with notes to echo, a gate a held chord to open, an
 * equalizer pink noise, a compressor pulses.
 */
export const DEMO_SOURCES = {
  chord: {
    about:
      "An A minor chord held for the whole loop: never quiet by itself, so a gate or a ducker has something to open and close.",
    render: renderHeldChord,
    title: "Held chord",
  },
  crank: {
    about:
      "DMV crank at 150 BPM, dry and fast: a few kicks with an 808 on each, a loud clap on a dry snare on the third beat, hats that tick on every sixteenth, a cowbell on the off-beats that clashes with them, and a short line of bells. To hear what a filter, a limiter or a saturator does to something hard and tight.",
    key: "crankKick",
    render: renderCrankLoop,
    tempo: CRANK_TEMPO,
    title: "Crank",
  },
  crankKick: {
    about:
      "The kick of the crank scene on its own: the key that goes with it, in step with its beats.",
    isKey: true,
    render: renderCrankKick,
    tempo: CRANK_TEMPO,
    title: "Crank kick",
  },
  groove: {
    about:
      "Two bars at 90 BPM with a lilt: a kick and a snare with ghost notes, hats that are not all alike, a bass, an electric piano on two chords and a line of plucked notes. A transient, a body and a tail, to hear what a delay, a reverb or a filter does.",
    render: renderDemoLoop,
    title: "Groove",
  },
  kick: {
    about:
      "The kick of the groove on its own: the key that a gate opens on and a compressor ducks a chord by.",
    isKey: true,
    render: renderKickLoop,
    title: "Kick",
  },
  noise: {
    about:
      "Pink noise, with equal energy per octave: a flat equalizer looks flat on a spectrum, and each band you move shows.",
    render: drawn((ctx) => pinkNoise(ctx)),
    title: "Pink noise",
  },
  pulses: {
    about:
      "Noise bursts that start loud and fade, every other one quieter: a level that moves along a compressor's transfer curve.",
    render: drawn((ctx) => pulses(ctx)),
    title: "Pulses",
  },
  hiphop: {
    about:
      "DMV hip-hop at 140 BPM, on the go-go pocket: hats that swing toward a triplet, a kick and a dry snare with a loud clap in the syncopated pattern of go-go, congas and a cowbell over it, an 808 that follows the kick, a haunting piano in F minor, a few ambient bells and a slow pad. To hear what a filter, a limiter or a saturator does.",
    key: "hiphopKick",
    render: renderHipHopLoop,
    tempo: HIPHOP_TEMPO,
    title: "Hip-hop",
  },
  hiphopKick: {
    about:
      "The kick of the hip-hop scene on its own: the key that goes with it, in step with its beats.",
    isKey: true,
    render: renderHipHopKick,
    tempo: HIPHOP_TEMPO,
    title: "Hip-hop kick",
  },
  voice: {
    about:
      "A held vowel with an s after it, four to a loop: what a de-esser takes off and leaves.",
    render: renderSibilantLoop,
    title: "Voice with an s",
  },
  wide: {
    about:
      "The groove in the centre, with a pad on each side a little detuned from the other and a low note that differs in each ear: a stereo image to narrow or widen.",
    render: renderWideLoop,
    title: "Wide chords",
  },
} satisfies Record<string, DemoSource>;

export type DemoSourceName = keyof typeof DEMO_SOURCES;

/** The key that goes with a sound: a kick drawn on its own beats, so a gate opens on the kick of the scene it hears. */
export function demoKey(name: DemoSourceName): DemoSourceName {
  const source: DemoSource = DEMO_SOURCES[name];
  const { key: keyName } = source;
  return keyName !== undefined && keyName in DEMO_SOURCES
    ? (keyName as DemoSourceName)
    : "kick";
}

/** The tempo of a sound: what a delay synced to it echoes on. */
export function demoTempo(name: DemoSourceName): Tempo {
  const source: DemoSource = DEMO_SOURCES[name];
  return source.tempo ?? DEMO_TEMPO;
}

/** The sound of a name, drawn for a sample rate and kept: the same buffer comes back each time. */
export function renderDemoSource(name: DemoSourceName, sampleRate: number) {
  return DEMO_SOURCES[name].render(sampleRate);
}
