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
 * The trap scene, from a written sketch: 150 BPM felt in half-time, F sharp
 * minor, straight on the grid, four bars. The snare and the clap fall together
 * once a bar; the hats run on a pattern of their own with a roll in thirty-
 * second notes, a roll in triplets of sixteenths that swells, and in the last
 * bar a roll that climbs five semitones. An 808 on F sharp slides to A and
 * C sharp. A pad opens under it, a small bell hides behind the clap, a pitched vocal chop
 * answers at the end of the second bar, and a reversed cymbal leads back to
 * the start.
 */

const TRAP_BPM = 150;
/** The tempo of the trap scene: what a delay synced to it echoes on. */
export const TRAP_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: TRAP_BPM };
const TRAP_STEP_SECONDS = 60 / TRAP_BPM / 4;
const TRAP_BARS = 4;
const TRAP_STEPS_PER_BAR = 16;
const TRAP_LOOP_SECONDS = (TRAP_BARS * 4 * 60) / TRAP_BPM;
const TRAP_TRIM = 0.33;

/** The moment of a sixteenth step of the trap scene: straight. */
const trapTimeOf = (step: number) => step * TRAP_STEP_SECONDS;

/** The step of a bar, from the start of the loop. */
const barStep = (bar: number, step: number) => bar * TRAP_STEPS_PER_BAR + step;

/** Pitches of the scene, in hertz. */
const E1_HZ = 41.2;
const F_SHARP_1_HZ = 46.25;
const A1_HZ = 55;
const C_SHARP_2_HZ = 69.3;
/** How long a slide of the 808 takes. */
const GLIDE_SECONDS = 0.07;

/** The kick of the first three bars: the one and the eleven (counting steps from one). */
const TRAP_KICK_STEPS = [0, 10];
/** The kick of the last bar, which breaks the pattern: the one, the seven and the fourteen. */
const TRAP_KICK_STEPS_LAST = [0, 6, 13];
const TRAP_KICKS: Hit[] = [0, 1, 2, 3].flatMap((bar) =>
  (bar === TRAP_BARS - 1 ? TRAP_KICK_STEPS_LAST : TRAP_KICK_STEPS).map(
    (step): Hit => [barStep(bar, step), step === 0 ? 1 : 0.8]
  )
);
/** The snare and the clap fall together on the nine of each bar: half-time. */
const TRAP_CRACKS: Hit[] = [0, 1, 2, 3].map((bar): Hit => [barStep(bar, 8), 1]);

/** A hat: where it falls (a fraction of a step for a roll), how hard, and how far up in semitones. */
type TrapHat = [step: number, velocity: number, tune: number];

/** A roll of `count` hits from `step`, `spacing` of a step apart, each harder than the last and `tuneRise` semitones higher. */
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
      0.35 + (0.4 * index) / Math.max(1, count - 1),
      index * tuneRise,
    ]
  );
}

/** The hats of a bar. The pattern is struck on one, three, five, nine, eleven and thirteen, then on seven, eight, fifteen and sixteen, which two rolls replace. */
function barHats(bar: number): TrapHat[] {
  const last = bar === TRAP_BARS - 1;
  const struck = [0, 2, 4, 8, 10, ...(last ? [] : [12])];
  const hits: TrapHat[] = struck.map(
    (step): TrapHat => [barStep(bar, step), step % 4 === 0 ? 0.9 : 0.65, 0]
  );
  return [
    ...hits,
    // Steps seven and eight: thirty-second notes.
    ...roll(barStep(bar, 6), 4, 0.5, 0),
    // The end of the bar: a roll of triplets of sixteenths that swells, and in the last bar thirty-second notes that climb five semitones.
    ...(last
      ? roll(barStep(bar, 12), 8, 0.5, 5 / 7)
      : roll(barStep(bar, 14), 3, 2 / 3, 0)),
  ];
}
const TRAP_HATS: TrapHat[] = [0, 1, 2, 3].flatMap(barHats);

/** An open hat, light, on the fifteen of each bar, and when the closed hat after it cuts it off. */
const TRAP_OPEN_HATS: [step: number, cutAt: number][] = [0, 1, 2, 3].map(
  (bar): [number, number] => [
    barStep(bar, 14),
    barStep(bar, bar === TRAP_BARS - 1 ? 14.5 : 14 + 2 / 3),
  ]
);
const TRAP_OPEN_HAT_VELOCITY = 0.4;

/** An 808 note: the step it starts on, how long it lasts, and the pitches it passes through with where each slide begins, in seconds from the start. */
type BassNote = {
  path: [offset: number, hertz: number][];
  seconds: number;
  step: number;
};
const S = TRAP_STEP_SECONDS;
function barBass(bar: number): BassNote[] {
  const first: BassNote[] = [
    // F sharp on the one, held until the four.
    { path: [[0, F_SHARP_1_HZ]], seconds: 3 * S, step: barStep(bar, 0) },
    // F sharp on the four, short.
    { path: [[0, F_SHARP_1_HZ]], seconds: 1 * S, step: barStep(bar, 3) },
  ];
  if (bar === TRAP_BARS - 1) {
    // The last bar: E on the seven, sliding up to F sharp on the fourteen.
    return [
      ...first,
      {
        path: [
          [0, E1_HZ],
          [7 * S, F_SHARP_1_HZ],
        ],
        seconds: 10 * S,
        step: barStep(bar, 6),
      },
    ];
  }
  return [
    ...first,
    // A on the eleven, sliding up to C sharp on the thirteen, and falling back to F sharp just before the next bar.
    {
      path: [
        [0, A1_HZ],
        [2 * S, C_SHARP_2_HZ],
        [6 * S - GLIDE_SECONDS, F_SHARP_1_HZ],
      ],
      seconds: 6 * S,
      step: barStep(bar, 10),
    },
  ];
}
const TRAP_808: BassNote[] = [0, 1, 2, 3].flatMap(barBass);

/** The pad: an F sharp minor chord in each bar, in hertz. */
const TRAP_PAD_HZ = [185, 220, 277.18];
/** Where the pitched vocal chop answers: the sixteen of the second bar. */
const TRAP_VOCAL_STEP = barStep(1, 15);
/** The reversed cymbal leads from the second half of the last bar back to the start. */
const TRAP_CYMBAL_STEP = barStep(3, 8);
/** The small high bell hidden behind the clap, on the nine of each bar. */
const TRAP_TINY_BELL_HZ = 2959.96;
const TRAP_KICK_LEVEL = 0.65;
const TRAP_808_LEVEL = 0.55;
const TRAP_SNARE_LEVEL = 0.4;
const TRAP_CLAP_LEVEL = 0.5;
const TRAP_ROOM_LEVEL = 0.22;
const TRAP_HAT_LEVEL = 0.4;
const TRAP_HAT_PAN = 0.5;
const TRAP_PAD_LEVEL = 0.03;
const TRAP_VOCAL_LEVEL = 0.1;
const TRAP_CYMBAL_LEVEL = 0.08;
const TRAP_TINY_BELL_LEVEL = 0.03;
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
 * An 808: a sine that goes through the pitches of `path`, each slide taking a
 * tenth of a second or so. It goes two ways: a clean sub, low-passed so
 * nothing above it is in the way, and the same note driven hard and high-
 * passed, which is the bite.
 */
function sub808(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  path: [offset: number, hertz: number][],
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
  let previous = path[0]?.[1] ?? F_SHARP_1_HZ;
  oscillator.frequency.setValueAtTime(previous, time);
  for (const [offset, hertz] of path.slice(1)) {
    oscillator.frequency.setValueAtTime(previous, time + offset);
    oscillator.frequency.exponentialRampToValueAtTime(
      hertz,
      time + offset + GLIDE_SECONDS
    );
    previous = hertz;
  }
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(TRAP_808_LEVEL, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(
    TRAP_808_LEVEL * 0.6,
    time + Math.min(0.4, seconds * 0.8)
  );
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

/** A hat as an 808 makes it: six square waves that do not fit together, high-passed, shut fast or let ring. */
function metalHat(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number,
  seconds: number
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
    oscillator.frequency.value = hertz;
    oscillator.connect(highs);
    oscillator.start(time);
    oscillator.stop(time + seconds + 0.02);
  }
}

/** A hat drawn once, as a buffer: every hat of the loop plays it again, as high as it is asked, so the loop does not build six oscillators for each of its hits. */
function drawHat(sampleRate: number, seconds: number) {
  const ctx = new OfflineAudioContext(
    1,
    Math.round(sampleRate * (seconds + 0.03)),
    sampleRate
  );
  metalHat(ctx, ctx.destination, 0, 1, seconds);
  return ctx.startRendering();
}

/** One hit of a drawn hat, lifted by `tune` semitones, and cut off at `cutAt` when a closed hat shuts it. */
function hatHit(
  ctx: BaseAudioContext,
  destination: AudioNode,
  hat: AudioBuffer,
  time: number,
  level: number,
  tune: number,
  cutAt?: number
) {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = hat;
  source.playbackRate.value = 2 ** (tune / 12);
  gain.gain.setValueAtTime(level, time);
  if (cutAt !== undefined) {
    gain.gain.setValueAtTime(level, cutAt - 0.004);
    gain.gain.linearRampToValueAtTime(0, cutAt);
  }
  source.connect(gain).connect(destination);
  source.start(time);
  if (cutAt !== undefined) {
    source.stop(cutAt + 0.01);
  }
}

/** A pad of detuned saws, each note three times a few cents apart and spread across the field, through a low-pass that opens slowly. It swells in and lets go before the next. */
function ragePad(
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
  tone.Q.value = 2;
  tone.frequency.setValueAtTime(500, time);
  tone.frequency.exponentialRampToValueAtTime(3200, time + seconds);
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(level, time + 0.6);
  gain.gain.setValueAtTime(level, time + seconds - 0.8);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
  gain.connect(tone).connect(destination);
  for (const hertz of hertzList) {
    for (const [cents, pan] of [
      [-14, -0.7],
      [0, 0],
      [14, 0.7],
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

/** A vocal chop, "yuh", pitched up: a saw whose pitch rises, through two formants that slide from a "y" to an "uh", with a breath of noise at the start. */
function vocalChop(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number
) {
  const seconds = 0.22;
  const voice = ctx.createOscillator();
  const first = ctx.createBiquadFilter();
  const second = ctx.createBiquadFilter();
  const secondLevel = ctx.createGain();
  const gain = ctx.createGain();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(260, time);
  voice.frequency.exponentialRampToValueAtTime(340, time + 0.12);
  first.type = "bandpass";
  first.Q.value = 6;
  first.frequency.setValueAtTime(400, time);
  first.frequency.exponentialRampToValueAtTime(700, time + 0.07);
  second.type = "bandpass";
  second.Q.value = 6;
  second.frequency.setValueAtTime(2200, time);
  second.frequency.exponentialRampToValueAtTime(1150, time + 0.07);
  secondLevel.gain.value = 0.6;
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.linearRampToValueAtTime(level, time + 0.01);
  gain.gain.setValueAtTime(level, time + 0.07);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + seconds);
  voice.connect(first).connect(gain);
  voice.connect(second).connect(secondLevel).connect(gain);
  gain.connect(destination);
  voice.start(time);
  voice.stop(time + seconds + 0.02);
  const breath = ctx.createBufferSource();
  const breathHighs = ctx.createBiquadFilter();
  const breathGain = ctx.createGain();
  breath.buffer = noiseBuffer(ctx, 0.06, 110);
  breathHighs.type = "highpass";
  breathHighs.frequency.value = 3000;
  breathGain.gain.setValueAtTime(level * 0.2, time);
  breathGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.05);
  breath.connect(breathHighs).connect(breathGain).connect(destination);
  breath.start(time);
  breath.stop(time + 0.06);
}

/** A reversed cymbal: noise that swells and brightens for `seconds`, then stops on the beat it leads to, as a cymbal played backwards does. */
function reverseCymbal(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  seconds: number,
  level: number
) {
  const source = ctx.createBufferSource();
  const band = ctx.createBiquadFilter();
  const highs = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer(ctx, seconds + 0.05, 120);
  band.type = "bandpass";
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(2000, time);
  band.frequency.exponentialRampToValueAtTime(9000, time + seconds);
  highs.type = "highpass";
  highs.frequency.value = 1500;
  gain.gain.setValueAtTime(SILENCE_FLOOR, time);
  gain.gain.exponentialRampToValueAtTime(level, time + seconds - 0.01);
  gain.gain.linearRampToValueAtTime(0, time + seconds);
  source.connect(band).connect(highs).connect(gain).connect(destination);
  source.start(time);
  source.stop(time + seconds + 0.02);
}

/** A small high bell: a triangle that rings a quarter of a second, there to sit behind the clap. */
function tinyBell(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  level: number
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = TRAP_TINY_BELL_HZ;
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + 0.3);
  oscillator.connect(gain).connect(destination);
  oscillator.start(time);
  oscillator.stop(time + 0.32);
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

/** What the drums, the 808, the pad, the vocal chop, the cymbal and the small bell play, over four bars. */
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
    tinyBell(ctx, crack, time, TRAP_TINY_BELL_LEVEL);
  }
  for (const [step, velocity, tune] of TRAP_HATS) {
    const time = trapTimeOf(step) + (random() - 0.5) * 0.004;
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
  for (const [step, cutAt] of TRAP_OPEN_HATS) {
    hatHit(
      ctx,
      bus(ctx, glue, 1, TRAP_HAT_PAN),
      hats.open,
      trapTimeOf(step),
      TRAP_HAT_LEVEL * TRAP_OPEN_HAT_VELOCITY,
      0,
      trapTimeOf(cutAt)
    );
  }
  for (const { path, seconds, step } of TRAP_808) {
    sub808(ctx, bass, trapTimeOf(step), path, seconds);
  }
  for (const bar of [0, 1, 2, 3]) {
    ragePad(
      ctx,
      pad,
      trapTimeOf(barStep(bar, 0)),
      TRAP_PAD_HZ,
      TRAP_STEPS_PER_BAR * TRAP_STEP_SECONDS + 0.8,
      TRAP_PAD_LEVEL
    );
  }
  vocalChop(ctx, glue, trapTimeOf(TRAP_VOCAL_STEP), TRAP_VOCAL_LEVEL);
  reverseCymbal(
    ctx,
    glue,
    trapTimeOf(TRAP_CYMBAL_STEP),
    TRAP_LOOP_SECONDS - trapTimeOf(TRAP_CYMBAL_STEP),
    TRAP_CYMBAL_LEVEL
  );
}

const trapped = new Map<number, Promise<AudioBuffer>>();

/**
 * Trap hip-hop at 150 BPM felt in half-time, in F sharp minor, four bars: a
 * kick, a snare and a clap that fall together once a bar, hats with three
 * kinds of roll, an 808 that slides, a pad that opens, a small bell behind the clap, a pitched
 * vocal chop and a reversed cymbal. To hear what a filter, a limiter or a
 * saturator does.
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
      "Trap hip-hop at 150 BPM felt in half-time, in F sharp minor, straight on the grid: a snare and a clap that fall together once a bar, hats with three kinds of roll, an 808 that slides, a pad that opens, a small bell behind the clap, a pitched vocal chop and a reversed cymbal. To hear what a filter, a limiter or a saturator does.",
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
