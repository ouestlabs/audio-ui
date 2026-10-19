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

/* Two signals made of noise for the plots, then the catalogue of the sounds a preview plays. */

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

/** The sounds a preview plays, by name. The key is not offered: a gate or a ducker follows them. */
export const DEMO_SOURCES = {
  chord: {
    about:
      "An A minor chord that never stops: a gate or a ducker has something to open and close.",
    render: renderHeldChord,
    title: "Drone",
  },
  groove: {
    about:
      "Two bars of boom bap at 90 BPM: drums, bass, keys and a plucked line.",
    render: renderDemoLoop,
    title: "Boom bap",
  },
  kick: {
    about: "The kick of the boom bap alone: its key.",
    isKey: true,
    render: renderKickLoop,
    title: "Boom bap kick",
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
