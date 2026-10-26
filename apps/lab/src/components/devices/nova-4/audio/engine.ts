/**
 * The sound of Nova-4: an eight-voice FM synth of four operators. Each key
 * gets a voice of four sine oscillators, wired by the algorithm: a modulator's
 * output is added to the frequency of the operator under it, so the carrier's
 * sine bends at audio rate and grows harmonics; the deeper the modulation (the
 * modulator's level), the brighter. Each operator has its own envelope, so a
 * sound can start bright and mellow as it rings, the way an electric piano or
 * a bell does. Operator 4 can modulate itself: here that feedback is a wave
 * that goes from a sine towards a saw, which is what a fed-back operator
 * sounds like.
 *
 * The controls speak in the panel's 0 to 10 (the ratio, in steps of a list);
 * each one is mapped here to the unit the node takes. Parameters move with
 * ramps, never assigned, and the engine plays into the bus it is attached to,
 * which owns the master level and the safety limiter.
 */

import {
  type Algorithm,
  algorithmOf,
  OPERATORS,
  type Operator,
} from "./algorithms";

export const VOICES = 8;
/** The frequency ratios an operator can take, from an octave down to fourteen times up; the uneven ones ring like metal. */
export const RATIOS = [
  0.5, 1, 1.41, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 9, 11, 14,
] as const;

export type OperatorParam = "decay" | "level" | "ratio" | "sustain";
export type Param =
  | `${OperatorParam}${Operator}`
  | "algorithm"
  | "attack"
  | "feedback"
  | "release"
  | "vibrato";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings & { volume: number } = {
  algorithm: 5,
  attack: 0,
  decay1: 7,
  decay2: 5,
  decay3: 5,
  decay4: 3,
  feedback: 0,
  level1: 8,
  level2: 5,
  level3: 6,
  level4: 4,
  ratio1: 1,
  ratio2: 1,
  ratio3: 1,
  ratio4: 13,
  release: 3,
  sustain1: 0,
  sustain2: 2,
  sustain3: 0,
  sustain4: 0,
  vibrato: 1,
  volume: 7,
};

/** What one voice can reach at full velocity, all its carriers together: eight of them stay under the bus's limiter. */
const VOICE_GAIN = 0.2;
/** The deepest modulation: at the top of a modulator's level it swings the carrier seven times its own frequency. */
const MAX_INDEX = 7;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;
/** The softest key still sounds: a velocity of 0 is this fraction of a full one. */
const MIN_LEVEL = 0.25;
/** How much a soft key also darkens the sound: a modulator's depth at a velocity of 0. */
const MIN_BRIGHTNESS = 0.35;
const HARMONICS = 32;
/** How fast a stolen or retriggered voice goes, as a time constant, in seconds. */
const STEAL = 0.006;
const VIBRATO_HERTZ = 5.5;
const MIDDLE_C = 261.63;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const ratioOf = (index: number) =>
  RATIOS[Math.round(index)] ?? RATIOS[1];
export const attackSeconds = (value: number) => 0.002 * 500 ** unit(value);
export const decaySeconds = (value: number) => 0.03 * 300 ** unit(value);
export const releaseSeconds = (value: number) => 0.02 * 300 ** unit(value);
export const vibratoCents = (value: number) => unit(value) ** 2 * 40;
/** A carrier's share of the voice, or a modulator's depth, on a curve: the low half of a level is where the fine changes are. */
const amount = (level: number) => unit(level) ** 2;
/** High keys are modulated less, as on the hardware, or their harmonics fold back past the top of hearing into noise. */
const keyScale = (frequency: number) =>
  Math.min(1, (MIDDLE_C / frequency) ** 0.5);

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

/** Operator 4's wave: a sine with no feedback, then each harmonic a little stronger, towards the saw of a fed-back operator. */
function feedbackWave(ctx: BaseAudioContext, feedback: number) {
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  const depth = unit(feedback) * 0.9;
  for (let n = 1; n < HARMONICS; n += 1) {
    imag[n] = depth ** (n - 1) / n;
  }
  return ctx.createPeriodicWave(real, imag);
}

interface OperatorNodes {
  envelope: GainNode;
  oscillator: OscillatorNode;
  output: GainNode;
}

interface Voice {
  algorithm: Algorithm;
  amp: GainNode;
  frequency: number;
  operators: Record<Operator, OperatorNodes>;
  pitch: number;
  released: boolean;
  startedAt: number;
  velocity: number;
}

interface Graph {
  bus: GainNode;
  ctx: BaseAudioContext;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  wave: PeriodicWave;
}

export function createNovaEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const voices = new Set<Voice>();
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  const ratio = (operator: Operator) => ratioOf(settings[`ratio${operator}`]);

  /** What an operator sends on: a carrier its share of the voice, a modulator its swing in hertz. */
  function outputGain(voice: Voice, operator: Operator) {
    const level = amount(settings[`level${operator}`]);
    const { carriers } = voice.algorithm;
    if (carriers.includes(operator)) {
      return level / carriers.length;
    }
    const brightness = MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * voice.velocity;
    return (
      MAX_INDEX *
      level *
      voice.frequency *
      ratio(operator) *
      brightness *
      keyScale(voice.frequency)
    );
  }

  /** Lets a voice go along the release, or fast when it is taken for a new note. */
  function release(voice: Voice, fast = false) {
    if (!graph || voice.released) {
      return;
    }
    voice.released = true;
    const now = graph.ctx.currentTime;
    const seconds = fast ? STEAL * 4 : releaseSeconds(settings.release);
    for (const { envelope } of Object.values(voice.operators)) {
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(envelope.gain.value, now);
      envelope.gain.setTargetAtTime(0, now, fast ? STEAL : seconds / 4);
    }
    const end = now + seconds * 1.4 + 0.05;
    for (const { oscillator } of Object.values(voice.operators)) {
      oscillator.stop(end);
    }
  }

  function dispose(voice: Voice) {
    voices.delete(voice);
    for (const { envelope, oscillator, output } of Object.values(
      voice.operators
    )) {
      graph?.lfoDepth.disconnect(oscillator.detune);
      oscillator.disconnect();
      envelope.disconnect();
      output.disconnect();
    }
    voice.amp.disconnect();
  }

  /** Wakes the shared context from a key: not awaited, since on a first press the promise can wait for the pointer's release, after the key is up. */
  function wake(ctx: BaseAudioContext) {
    if (ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
      if (!unlock) {
        unlock = () => {
          (ctx as AudioContext).resume().catch(() => undefined);
        };
        document.addEventListener("pointerup", unlock, { once: true });
      }
    }
  }

  /** Before a key sounds: the same key retriggers, and a ninth takes the oldest voice. */
  function makeRoom(pitch: number) {
    for (const voice of voices) {
      if (voice.pitch === pitch) {
        release(voice, true);
      }
    }
    const live = [...voices].filter((other) => !other.released);
    if (live.length >= VOICES) {
      const oldest = live.reduce((a, b) =>
        a.startedAt <= b.startedAt ? a : b
      );
      release(oldest, true);
    }
  }

  /** What a sounding voice does when an operator's level or ratio moves: its output follows, and its pitch with the ratio. */
  function follow(operator: Operator) {
    for (const voice of voices) {
      const nodes = voice.operators[operator];
      smooth(nodes.oscillator.frequency, voice.frequency * ratio(operator));
      smooth(nodes.output.gain, outputGain(voice, operator));
    }
  }

  return {
    /** Builds the shared vibrato into `destination` (the bus): nothing sounds until a key. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const bus = ctx.createGain();
      bus.connect(destination);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = VIBRATO_HERTZ;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = vibratoCents(settings.vibrato);
      lfo.connect(lfoDepth);
      lfo.start();
      graph = {
        bus,
        ctx,
        lfo,
        lfoDepth,
        wave: feedbackWave(ctx, settings.feedback),
      };
    },
    /** Stops every voice and the vibrato, and disconnects what this engine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      for (const voice of [...voices]) {
        for (const { oscillator } of Object.values(voice.operators)) {
          oscillator.stop();
        }
        dispose(voice);
      }
      if (graph) {
        graph.lfo.stop();
        graph.lfo.disconnect();
        graph.lfoDepth.disconnect();
        graph.bus.disconnect();
      }
      graph = null;
    },
    noteOff(pitch: number) {
      for (const voice of voices) {
        if (voice.pitch === pitch && !voice.released) {
          release(voice);
        }
      }
    },
    /** Starts a voice for a key; `velocity` is from 0 to 1. The ninth key takes the oldest voice. */
    noteOn(pitch: number, velocity = 1) {
      if (!graph) {
        return;
      }
      const { bus, ctx, lfoDepth, wave } = graph;
      wake(ctx);
      makeRoom(pitch);

      const now = ctx.currentTime;
      const frequency = hertz(pitch);
      const amp = ctx.createGain();
      amp.gain.value = (MIN_LEVEL + (1 - MIN_LEVEL) * velocity) * VOICE_GAIN;
      amp.connect(bus);
      const make = (operator: Operator): OperatorNodes => {
        const oscillator = ctx.createOscillator();
        if (operator === 4) {
          oscillator.setPeriodicWave(wave);
        }
        oscillator.frequency.value = frequency * ratio(operator);
        lfoDepth.connect(oscillator.detune);
        const envelope = ctx.createGain();
        envelope.gain.value = 0;
        const output = ctx.createGain();
        oscillator.connect(envelope).connect(output);
        return { envelope, oscillator, output };
      };
      const voice: Voice = {
        algorithm: algorithmOf(settings.algorithm),
        amp,
        frequency,
        operators: { 1: make(1), 2: make(2), 3: make(3), 4: make(4) },
        pitch,
        released: false,
        startedAt: now,
        velocity,
      };

      // The algorithm's wiring: a carrier into the voice, a modulator into the frequency of the one under it.
      for (const operator of OPERATORS) {
        voice.operators[operator].output.gain.value = outputGain(
          voice,
          operator
        );
      }
      for (const carrier of voice.algorithm.carriers) {
        voice.operators[carrier].output.connect(amp);
      }
      for (const [from, to] of voice.algorithm.links) {
        voice.operators[from].output.connect(
          voice.operators[to].oscillator.frequency
        );
      }

      // Each operator's envelope: the shared attack, then its own decay to its own sustain.
      const attack = attackSeconds(settings.attack);
      for (const operator of OPERATORS) {
        const { gain } = voice.operators[operator].envelope;
        gain.setTargetAtTime(1, now, attack / 4);
        gain.setTargetAtTime(
          unit(settings[`sustain${operator}`]),
          now + attack,
          decaySeconds(settings[`decay${operator}`]) / 3
        );
      }

      voice.operators[1].oscillator.onended = () => dispose(voice);
      voices.add(voice);
      for (const { oscillator } of Object.values(voice.operators)) {
        oscillator.start(now);
      }
    },
    /** Lets every voice go: a panic, or a voice change that should not leave old notes ringing. */
    releaseAll() {
      for (const voice of voices) {
        release(voice);
      }
    },
    /** A control moved: the engine, and every voice sounding, follows. The algorithm and the envelopes take the next note. */
    set(key: Param, value: number) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      if (key === "vibrato") {
        smooth(graph.lfoDepth.gain, vibratoCents(value));
        return;
      }
      if (key === "feedback") {
        graph.wave = feedbackWave(graph.ctx, value);
        for (const voice of voices) {
          voice.operators[4].oscillator.setPeriodicWave(graph.wave);
        }
        return;
      }
      const operator = Number(key.at(-1)) as Operator;
      if (key.startsWith("level") || key.startsWith("ratio")) {
        follow(operator);
      }
    },
  };
}

export type NovaEngine = ReturnType<typeof createNovaEngine>;
