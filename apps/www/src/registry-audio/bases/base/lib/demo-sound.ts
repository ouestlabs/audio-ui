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
 * The trap scene: trap hip-hop at 140 BPM in half-time, four bars on a
 * progression so it does not repeat itself. A layered kick, a long tuned 808
 * that ducks under it, one clap on the third beat of each bar thrown into a
 * small room, metallic hats that roll differently every bar and run into the
 * turn, and over it a haunting piano in F minor, a few far bells and a slow
 * pad. The drums and the bass go through a bus that glues them.
 */

const TRAP_BPM = 140;
/** The tempo of the trap scene: what a delay synced to it echoes on. */
export const TRAP_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: TRAP_BPM };
const TRAP_STEP_SECONDS = 60 / TRAP_BPM / 4;
const TRAP_BARS = 4;
const TRAP_STEPS_PER_BAR = 16;
const TRAP_LOOP_SECONDS = (TRAP_BARS * 4 * 60) / TRAP_BPM;
/** A light swing on the off-beat sixteenths: trap leans back a little, nowhere near a shuffle. */
const TRAP_SWING = 0.05;
const TRAP_TRIM = 0.3;

const trapTimeOf = (step: number) =>
  step * TRAP_STEP_SECONDS +
  (Number.isInteger(step) && step % 2 === 1
    ? TRAP_SWING * TRAP_STEP_SECONDS
    : 0);

/** The bar a step belongs to and the step in it, for patterns that repeat bar by bar. */
const barStep = (bar: number, step: number) => bar * TRAP_STEPS_PER_BAR + step;

/** The progression, one chord a bar: F minor, D flat, E flat, then C major, whose E against the F of the next bar is the pull back. The root of each, in hertz, is what the 808 plays. */
const TRAP_ROOTS_HZ = [43.65, 69.3, 77.78, 65.41];

/** The kick: on the one, a ghost just before the third beat's push, and the 808's second note. The last bar adds a push into the turn. */
const TRAP_KICK_BAR: Hit[] = [
  [0, 1],
  [7, 0.7],
  [10, 0.9],
];
const TRAP_KICKS: Hit[] = [
  ...[0, 1, 2, 3].flatMap((bar) =>
    TRAP_KICK_BAR.map(([step, velocity]): Hit => [barStep(bar, step), velocity])
  ),
  [barStep(3, 13), 0.6],
];
/** The 808: its first note on the one, a slide up a minor third and back on the ghost, its second note on the push. */
const TRAP_808: [step: number, steps: number, from: number, to: number][] = [
  0, 1, 2, 3,
].flatMap((bar) => {
  const root = TRAP_ROOTS_HZ[bar] ?? 43.65;
  return [
    [barStep(bar, 0), 7, root, root],
    [barStep(bar, 7), 3, root * 1.1892, root],
    [barStep(bar, 10), 6, root, root],
  ] as [number, number, number, number][];
});
/** One clap on the third beat of each bar: half-time. */
const TRAP_CRACKS: Hit[] = [8, 24, 40, 56].map((step): Hit => [step, 1]);
/** The snare that climbs into the turn of the loop. */
const TRAP_RISE: Hit[] = [
  [60, 0.25],
  [61, 0.35],
  [62, 0.5],
  [63, 0.7],
];
/** A hat: where it falls (a fraction of a step for a roll), how hard, and how far up in semitones. */
type TrapHat = [step: number, velocity: number, tune: number];

/** How hard the hat of an eighth is struck: the beat hardest, the half beat next, the ones between softest. */
function eighthVelocity(index: number) {
  if (index % 4 === 0) {
    return 0.9;
  }
  return index % 2 === 0 ? 0.7 : 0.5;
}

/** A roll of `count` hits from `step`, `spacing` of a step apart, each harder and higher than the last. */
function roll(
  step: number,
  count: number,
  spacing: number,
  tuneRise: number
): TrapHat[] {
  return Array.from(
    { length: count },
    (_, index): TrapHat => [
      step + index * spacing,
      0.3 + (0.45 * index) / Math.max(1, count - 1),
      index * tuneRise,
    ]
  );
}

const TRAP_HATS: TrapHat[] = [
  // Straight eighths all through, the beat hardest.
  ...Array.from(
    { length: TRAP_BARS * 8 },
    (_, index): TrapHat => [index * 2, eighthVelocity(index % 8), 0]
  ),
  // Each bar rolls its own way: thirty-second notes, a triplet, a rising run, and a long run into the turn.
  ...roll(barStep(0, 13), 4, 0.25, 1),
  ...roll(barStep(1, 5), 3, 1 / 3, 1),
  ...roll(barStep(2, 14), 6, 1 / 6, 0.8),
  ...roll(barStep(3, 14.5), 12, 0.125, 0.5),
];
const TRAP_OPEN_HATS: Hit[] = [6, 22, 38, 54].map((step): Hit => [step, 0.5]);

/** The piano's line over the four chords: the step, the pitch in hertz and how hard. The notes sit a semitone apart, E against F, B flat against C, D against E flat, which is what makes it uneasy. */
const TRAP_PIANO: [step: number, hertz: number, velocity: number][] = [
  [0, 349.23, 0.8],
  [4, 329.63, 0.55],
  [6, 349.23, 0.7],
  [10, 415.3, 0.6],
  [16, 523.25, 0.75],
  [20, 466.16, 0.5],
  [22, 523.25, 0.65],
  [26, 554.37, 0.6],
  [32, 311.13, 0.8],
  [36, 293.66, 0.55],
  [38, 311.13, 0.7],
  [42, 392, 0.6],
  [48, 659.25, 0.75],
  [52, 622.25, 0.5],
  [54, 659.25, 0.65],
  [58, 783.99, 0.6],
];
/** The first note of each bar again an octave down, to darken it. */
const TRAP_PIANO_LOW: [step: number, hertz: number, velocity: number][] = [
  [0, 174.61, 0.6],
  [16, 138.59, 0.6],
  [32, 155.56, 0.6],
  [48, 130.81, 0.6],
];
/** A few high bells, far off. */
const TRAP_BELLS: [step: number, hertz: number, velocity: number][] = [
  [8, 1396.91, 0.6],
  [24, 1108.73, 0.6],
  [40, 1244.51, 0.6],
  [56, 1318.51, 0.6],
];
/** The pad of each bar, in hertz: F minor, D flat major, E flat major, C major. */
const TRAP_PAD_HZ = [
  [174.61, 207.65, 261.63],
  [138.59, 174.61, 207.65],
  [155.56, 196, 233.08],
  [130.81, 164.81, 196],
];
const TRAP_KICK_LEVEL = 0.65;
const TRAP_808_LEVEL = 0.55;
const TRAP_SNARE_LEVEL = 0.4;
const TRAP_CLAP_LEVEL = 0.5;
const TRAP_ROOM_LEVEL = 0.22;
const TRAP_HAT_LEVEL = 0.4;
const TRAP_HAT_PAN = 0.5;
const TRAP_PIANO_LEVEL = 0.09;
const TRAP_PIANO_PAN = 0.2;
const TRAP_BELL_LEVEL = 0.035;
const TRAP_BELL_PAN = 0.5;
const TRAP_PAD_LEVEL = 0.03;
/** How far the 808 and the pad dip under a kick, and how long they take to come back. */
const TRAP_DUCK_808 = 0.45;
const TRAP_DUCK_PAD = 0.6;
const TRAP_DUCK_RECOVERY = 0.14;

/** A clip of a given drive: it gives a sine harmonics a small speaker can play, and rounds the peaks of a bus. */
function clipCurve(drive: number) {
  const curve = new Float32Array(2048);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
const DRIVEN_CLIP = clipCurve(8);
const BUS_CLIP = clipCurve(1.6);

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
  gain.gain.linearRampToValueAtTime(TRAP_808_LEVEL, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(TRAP_808_LEVEL * 0.5, time + 0.4);
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

/** Noise from a fixed sequence, so a clap, a click or a room is the same each time. */
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

/** A small room: half a second of noise that dies away, a different one in each ear. */
function roomImpulse(ctx: BaseAudioContext) {
  const length = Math.round(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (const [channelIndex, seed] of [81, 82].entries()) {
    const random = seededRandom(seed);
    const data = buffer.getChannelData(channelIndex);
    for (let index = 0; index < length; index += 1) {
      const decay = Math.exp(-index / ctx.sampleRate / 0.09);
      data[index] = (random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

/** A kick in three layers: the body, a sine that falls fast; a sub under it that stays; and a click of noise at the strike, which is what makes it heard on a small speaker. */
function trapKick(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number
) {
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(165, time);
  body.frequency.exponentialRampToValueAtTime(48, time + 0.07);
  bodyGain.gain.setValueAtTime(level, time);
  bodyGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.26);
  body.connect(bodyGain).connect(destination);
  body.start(time);
  body.stop(time + 0.28);
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = "sine";
  sub.frequency.value = 52;
  subGain.gain.setValueAtTime(level * 0.6, time);
  subGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.34);
  sub.connect(subGain).connect(destination);
  sub.start(time);
  sub.stop(time + 0.36);
  const click = ctx.createBufferSource();
  const clickHighs = ctx.createBiquadFilter();
  const clickGain = ctx.createGain();
  click.buffer = noiseBuffer(ctx, 0.02, 95);
  clickHighs.type = "highpass";
  clickHighs.frequency.value = 2500;
  clickGain.gain.setValueAtTime(level * 0.35, time);
  clickGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.008);
  click.connect(clickHighs).connect(clickGain).connect(destination);
  click.start(time);
  click.stop(time + 0.02);
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

/** The inharmonic squares of an 808 hat, in hertz: what makes it metal and not noise. */
const METAL_HZ = [205.3, 304.4, 369.6, 522.7, 540, 800];

/** A hat as an 808 makes it: six square waves that do not fit together, high-passed, shut fast or let ring. `tune` lifts it in semitones. */
function metalHat(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number,
  seconds: number,
  tune: number
) {
  const highs = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  highs.type = "highpass";
  highs.frequency.value = 7000;
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(level, time + 0.0005);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
  highs.connect(gain).connect(destination);
  for (const hertz of METAL_HZ) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = hertz * 2 ** (tune / 12);
    oscillator.connect(highs);
    oscillator.start(time);
    oscillator.stop(time + seconds + 0.02);
  }
}

/** A hat drawn once, as a buffer: every hat of the loop plays it again, as high as it is asked, so the loop does not build six oscillators for each of its sixty hits. */
function drawHat(sampleRate: number, seconds: number) {
  const ctx = new OfflineAudioContext(
    1,
    Math.round(sampleRate * (seconds + 0.03)),
    sampleRate
  );
  metalHat(ctx, ctx.destination, 0, 1, seconds, 0);
  return ctx.startRendering();
}

/** One hit of a drawn hat, lifted by `tune` semitones: a source and a gain. */
function hatHit(
  ctx: BaseAudioContext,
  destination: AudioNode,
  hat: AudioBuffer,
  time: number,
  level: number,
  tune: number
) {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = hat;
  source.playbackRate.value = 2 ** (tune / 12);
  gain.gain.value = level;
  source.connect(gain).connect(destination);
  source.start(time);
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

/** Dips a gain under each of the times and lets it back up: what a sidechain does, drawn ahead since the times are known. */
function duck(gain: AudioParam, times: number[], depth: number) {
  gain.setValueAtTime(1, 0);
  for (const time of times) {
    gain.setValueAtTime(1, Math.max(0, time - 0.002));
    gain.linearRampToValueAtTime(depth, time + 0.012);
    gain.linearRampToValueAtTime(1, time + TRAP_DUCK_RECOVERY);
  }
}

/** The kicks of the trap scene: the same each time, for the loop and for the key that follows it. */
function drawTrapKicks(ctx: BaseAudioContext, mix: AudioNode) {
  const random = seededRandom(31);
  for (const [step, velocity] of TRAP_KICKS) {
    const time = Math.max(0, trapTimeOf(step) + (random() - 0.5) * 0.003);
    trapKick(ctx, mix, time, TRAP_KICK_LEVEL * velocity);
  }
}

/** What the drums, the 808, the piano, the bells and the pad play, over four bars. */
function drawTrap(
  ctx: BaseAudioContext,
  out: AudioNode,
  hats: { closed: AudioBuffer; open: AudioBuffer }
) {
  const random = seededRandom(37);
  const kickTimes = TRAP_KICKS.map(([step]) => trapTimeOf(step));
  // The bus: everything goes through a compressor that glues it and a soft clip that rounds its peaks.
  const glue = ctx.createDynamicsCompressor();
  const rounder = ctx.createWaveShaper();
  const mix = ctx.createGain();
  glue.threshold.value = -14;
  glue.knee.value = 8;
  glue.ratio.value = 2;
  glue.attack.value = 0.012;
  glue.release.value = 0.14;
  rounder.curve = BUS_CLIP;
  mix.gain.value = TRAP_TRIM;
  glue.connect(rounder).connect(mix).connect(out);
  const room = ctx.createConvolver();
  const wet = ctx.createGain();
  room.buffer = roomImpulse(ctx);
  wet.gain.value = TRAP_ROOM_LEVEL;
  room.connect(wet).connect(glue);
  // The snare and the clap go dry to the bus and into the room.
  const crack = ctx.createGain();
  crack.connect(glue);
  crack.connect(room);
  // The 808 and the pad give way a moment under each kick.
  const bass = ctx.createGain();
  const pad = ctx.createGain();
  bass.connect(glue);
  pad.connect(glue);
  duck(bass.gain, kickTimes, TRAP_DUCK_808);
  duck(pad.gain, kickTimes, TRAP_DUCK_PAD);
  drawTrapKicks(ctx, glue);
  for (const [step, velocity] of TRAP_CRACKS) {
    const time = trapTimeOf(step);
    triggerSnare(ctx, bus(ctx, crack, TRAP_SNARE_LEVEL * velocity), time, {
      tune: 1,
    });
    clap(ctx, crack, time, TRAP_CLAP_LEVEL * velocity);
  }
  for (const [step, velocity] of TRAP_RISE) {
    triggerSnare(
      ctx,
      bus(ctx, crack, TRAP_SNARE_LEVEL * velocity),
      trapTimeOf(step),
      { tune: 4 }
    );
  }
  for (const [step, velocity, tune] of TRAP_HATS) {
    const time = trapTimeOf(step) + (random() - 0.5) * 0.005;
    const level = TRAP_HAT_LEVEL * velocity * (0.92 + 0.16 * random());
    hatHit(
      ctx,
      bus(ctx, glue, 1, TRAP_HAT_PAN),
      hats.closed,
      time,
      level,
      tune
    );
  }
  for (const [step, velocity] of TRAP_OPEN_HATS) {
    hatHit(
      ctx,
      bus(ctx, glue, 1, TRAP_HAT_PAN),
      hats.open,
      trapTimeOf(step),
      TRAP_HAT_LEVEL * velocity,
      0
    );
  }
  for (const [step, steps, from, to] of TRAP_808) {
    sub808(
      ctx,
      bass,
      trapTimeOf(step),
      from,
      to,
      steps * TRAP_STEP_SECONDS + 0.12
    );
  }
  for (const [index, [step, hertz, velocity]] of TRAP_PIANO.entries()) {
    pianoNote(
      ctx,
      glue,
      trapTimeOf(step),
      hertz,
      TRAP_PIANO_LEVEL * velocity,
      index % 2 === 0 ? -TRAP_PIANO_PAN : TRAP_PIANO_PAN
    );
  }
  for (const [step, hertz, velocity] of TRAP_PIANO_LOW) {
    pianoNote(
      ctx,
      glue,
      trapTimeOf(step),
      hertz,
      TRAP_PIANO_LEVEL * velocity,
      0
    );
  }
  for (const [index, [step, hertz, velocity]] of TRAP_BELLS.entries()) {
    bell(
      ctx,
      glue,
      trapTimeOf(step),
      hertz,
      TRAP_BELL_LEVEL * velocity,
      index % 2 === 0 ? -TRAP_BELL_PAN : TRAP_BELL_PAN
    );
  }
  for (const [bar, chord] of TRAP_PAD_HZ.entries()) {
    padChord(
      ctx,
      pad,
      trapTimeOf(barStep(bar, 0)),
      chord,
      TRAP_STEPS_PER_BAR * TRAP_STEP_SECONDS + 0.8,
      TRAP_PAD_LEVEL
    );
  }
}

const trapped = new Map<number, Promise<AudioBuffer>>();

/**
 * Trap hip-hop at 140 BPM in half-time, four bars on a progression: a layered
 * kick, a long tuned 808 that ducks under it, one clap on the third beat in a
 * small room, metallic hats that roll differently every bar and run into the
 * turn, a haunting piano in F minor with notes a semitone apart, a few far
 * bells and a slow pad, all through a bus that glues them. To hear what a
 * filter, a limiter or a saturator does.
 */
export function renderTrapLoop(sampleRate: number): Promise<AudioBuffer> {
  const cached = trapped.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = Promise.all([
    drawHat(sampleRate, 0.04),
    drawHat(sampleRate, 0.3),
  ]).then(([closed, open]) =>
    drawLoop(sampleRate, TRAP_LOOP_SECONDS, (ctx, out) =>
      drawTrap(ctx, out, { closed, open })
    )
  );
  trapped.set(sampleRate, buffer);
  return buffer;
}

const trapKeyed = new Map<number, Promise<AudioBuffer>>();

/** The kick of the trap scene on its own: the key a sidechain listens to, in step with `renderTrapLoop`. */
export function renderTrapKick(sampleRate: number): Promise<AudioBuffer> {
  const cached = trapKeyed.get(sampleRate);
  if (cached) {
    return cached;
  }
  const buffer = drawLoop(sampleRate, TRAP_LOOP_SECONDS, drawTrapKicks);
  trapKeyed.set(sampleRate, buffer);
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
  trap: {
    about:
      "Trap hip-hop at 140 BPM in half-time, four bars on a progression: a layered kick, a long tuned 808 that ducks under it, one clap on the third beat in a small room, metallic hats that roll differently every bar, a haunting piano in F minor, a few far bells and a slow pad. To hear what a filter, a limiter or a saturator does.",
    key: "trapKick",
    render: renderTrapLoop,
    tempo: TRAP_TEMPO,
    title: "Trap",
  },
  trapKick: {
    about:
      "The kick of the trap scene on its own: the key that goes with it, in step with its beats.",
    isKey: true,
    render: renderTrapKick,
    tempo: TRAP_TEMPO,
    title: "Trap kick",
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
