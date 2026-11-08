import type { InstrumentBinding, NoteTiming } from "@audio-ui/core/device";
import {
  attackSeconds,
  decaySeconds,
  FM_OPERATORS,
  type FmAlgorithm,
  type FmOperator,
  type FmSynthNote,
  type FmSynthState,
  fmAlgorithm,
  ratioOf,
  releaseSeconds,
  vibratoCents,
  volumeGain,
} from "@/components/audio-ui/devices/fm-synth/device";

/** What one voice can reach at full velocity, all its carriers together: struck alone, where a whole synth summed eight. */
const VOICE_GAIN = 0.8;
/** The deepest modulation: at the top of a modulator's level it swings the carrier seven times its own frequency. */
const MAX_INDEX = 7;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
/** The softest key still sounds: a velocity of 0 is this share of a full one. */
const MIN_LEVEL = 0.25;
/** How much a soft key also darkens the sound: a modulator's depth at a velocity of 0. */
const MIN_BRIGHTNESS = 0.35;
const HARMONICS = 32;
const VIBRATO_HERTZ = 5.5;
const MIDDLE_C = 261.63;
/** How long a voice rings after its release starts, as releases. */
const RELEASE_TAIL = 1.4;
/** How fast a note struck again cuts the one its voice held. */
const RESTRIKE = 0.006;

/** A carrier's share of the voice, or a modulator's depth, on a curve: the low half of a level is where the fine changes are. */
const amount = (level: number) => (level / 10) ** 2;
/** High keys are modulated less, or their harmonics fold back past the top of hearing into noise. */
const keyScale = (frequency: number) =>
  Math.min(1, (MIDDLE_C / frequency) ** 0.5);

export interface FmSynthEngine
  extends InstrumentBinding<FmSynthState, FmSynthNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface OperatorNodes {
  envelope: GainNode;
  oscillator: OscillatorNode;
  output: GainNode;
}

interface Voice {
  algorithm: FmAlgorithm;
  amp: GainNode;
  frequency: number;
  id: NoteTiming["id"];
  operators: Record<FmOperator, OperatorNodes>;
  start: number;
  velocity: number;
}

/** Operator 4's wave: a sine with no feedback, then each harmonic a little stronger, towards the saw of a fed-back operator. */
function feedbackWave(ctx: BaseAudioContext, feedback: number) {
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  const depth = (feedback / 10) * 0.9;
  for (let n = 1; n < HARMONICS; n += 1) {
    imag[n] = depth ** (n - 1) / n;
  }
  return ctx.createPeriodicWave(real, imag);
}

/**
 * One voice of the FM Synth on the Web Audio API, for an `FmSynthState`:
 *
 * ```
 * four sine operators, wired by the algorithm:
 *   a modulator → the frequency of the operator under it
 *   a carrier   → amp → output (the volume)
 * vibrato → every operator's detune; operator 4 fed back, from a sine towards a saw
 * ```
 *
 * A host plays chords with several of them, one note each. Each operator
 * heads for full over the shared attack, then for its own sustain over its
 * own decay, so a sound can start bright and mellow as it rings; a harder key
 * is louder and brighter, and the treble is modulated less. Let go, every
 * operator falls back over the release from where it had got to. A note while
 * one is held cuts it and strikes anew. A level, a ratio, the feedback and the
 * vibrato move a held note; the algorithm and the envelopes take the next.
 */
export function createFmSynthEngine(
  ctx: BaseAudioContext,
  initial: FmSynthState
): FmSynthEngine {
  let state = initial;
  let voice: Voice | null = null;
  let wave = feedbackWave(ctx, initial.feedback);

  const smooth = (param: AudioParam, value: number, at = ctx.currentTime) =>
    param.setTargetAtTime(value, at, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);
  const ratio = (operator: FmOperator) => ratioOf(state[`ratio${operator}`]);

  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = VIBRATO_HERTZ;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = vibratoCents(initial.vibrato);
  lfo.connect(lfoDepth);
  lfo.start();

  /** What an operator sends on: a carrier its share of the voice, a modulator its swing in hertz. */
  const outputGain = (held: Voice, operator: FmOperator) => {
    const level = amount(state[`level${operator}`]);
    const { carriers } = held.algorithm;
    if (carriers.includes(operator)) {
      return level / carriers.length;
    }
    const brightness = MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * held.velocity;
    return (
      MAX_INDEX *
      level *
      held.frequency *
      ratio(operator) *
      brightness *
      keyScale(held.frequency)
    );
  };

  /** Where an operator's envelope stands `elapsed` seconds in: up the attack, then down its decay to its sustain. */
  const envelopeAt = (operator: FmOperator, elapsed: number) => {
    const attack = attackSeconds(state.attack);
    if (elapsed < attack) {
      return 1 - Math.exp(-elapsed / (attack / 4));
    }
    const reached = 1 - Math.exp(-4);
    const sustain = state[`sustain${operator}`] / 10;
    const decay = decaySeconds(state[`decay${operator}`]);
    return (
      sustain +
      (reached - sustain) * Math.exp(-(elapsed - attack) / (decay / 3))
    );
  };

  const release = (held: Voice, time: number, fall?: number) => {
    const seconds = fall ?? releaseSeconds(state.release);
    for (const operator of FM_OPERATORS) {
      const { envelope } = held.operators[operator];
      envelope.gain.cancelScheduledValues(time);
      envelope.gain.setValueAtTime(
        envelopeAt(operator, time - held.start),
        time
      );
      envelope.gain.setTargetAtTime(0, time, fall ?? seconds / 4);
    }
    const end = time + seconds * RELEASE_TAIL + 0.05;
    for (const operator of FM_OPERATORS) {
      held.operators[operator].oscillator.stop(end);
    }
  };

  const strike = (note: FmSynthNote, id: Voice["id"], time: number): Voice => {
    const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
    const amp = ctx.createGain();
    amp.gain.value = (MIN_LEVEL + (1 - MIN_LEVEL) * velocity) * VOICE_GAIN;
    amp.connect(output);
    const make = (operator: FmOperator): OperatorNodes => {
      const oscillator = ctx.createOscillator();
      if (operator === 4) {
        oscillator.setPeriodicWave(wave);
      }
      oscillator.frequency.setValueAtTime(
        note.frequency * ratio(operator),
        time
      );
      lfoDepth.connect(oscillator.detune);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, time);
      const out = ctx.createGain();
      oscillator.connect(envelope).connect(out);
      return { envelope, oscillator, output: out };
    };
    const held: Voice = {
      algorithm: fmAlgorithm(state.algorithm),
      amp,
      frequency: note.frequency,
      id,
      operators: { 1: make(1), 2: make(2), 3: make(3), 4: make(4) },
      start: time,
      velocity,
    };
    // The algorithm's wiring: a carrier into the voice, a modulator into the frequency of the one under it.
    for (const operator of FM_OPERATORS) {
      held.operators[operator].output.gain.value = outputGain(held, operator);
    }
    for (const carrier of held.algorithm.carriers) {
      held.operators[carrier].output.connect(amp);
    }
    for (const [from, to] of held.algorithm.links) {
      held.operators[from].output.connect(
        held.operators[to].oscillator.frequency
      );
    }
    // Each operator's envelope: the shared attack, then its own decay to its own sustain.
    const attack = attackSeconds(state.attack);
    for (const operator of FM_OPERATORS) {
      const { gain } = held.operators[operator].envelope;
      gain.setTargetAtTime(1, time, attack / 4);
      gain.setTargetAtTime(
        state[`sustain${operator}`] / 10,
        time + attack,
        decaySeconds(state[`decay${operator}`]) / 3
      );
    }
    held.operators[1].oscillator.onended = () => {
      for (const operator of FM_OPERATORS) {
        const nodes = held.operators[operator];
        lfoDepth.disconnect(nodes.oscillator.detune);
        nodes.oscillator.disconnect();
        nodes.envelope.disconnect();
        nodes.output.disconnect();
      }
      amp.disconnect();
    };
    for (const operator of FM_OPERATORS) {
      held.operators[operator].oscillator.start(time);
    }
    return held;
  };

  return {
    dispose: () => {
      if (voice) {
        for (const operator of FM_OPERATORS) {
          voice.operators[operator].oscillator.stop();
        }
      }
      voice = null;
      lfo.stop();
      output.disconnect();
    },
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      release(voice, when(at));
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      if (voice) {
        release(voice, time, RESTRIKE);
      }
      voice = strike(note, id, time);
    },
    output,
    update: (next) => {
      const previous = state;
      state = next;
      smooth(output.gain, volumeGain(next.volume));
      smooth(lfoDepth.gain, vibratoCents(next.vibrato));
      if (previous.feedback !== next.feedback) {
        wave = feedbackWave(ctx, next.feedback);
        voice?.operators[4].oscillator.setPeriodicWave(wave);
      }
      if (!voice) {
        return;
      }
      for (const operator of FM_OPERATORS) {
        const nodes = voice.operators[operator];
        smooth(nodes.oscillator.frequency, voice.frequency * ratio(operator));
        smooth(nodes.output.gain, outputGain(voice, operator));
      }
    },
  };
}