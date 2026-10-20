/**
 * The sound of Pulsar-X: a monophonic voice for a finger on a plate. Two
 * oscillators a few cents apart and a sub oscillator an octave down, into a
 * resonant low-pass filter and an amplifier that the touch opens and closes,
 * then an echo. The plate's X is the pitch, which glides to its new value, and
 * its Y is the filter's cutoff.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), so a drag
 * makes no zipper noise, and the voice plays into the bus it is attached to,
 * which owns the master level and the safety limiter.
 */

import { ROOT } from "./scales";

export type Wave = "Saw" | "Square" | "Tri";
export type Param =
  | "feedback"
  | "glide"
  | "mix"
  | "resonance"
  | "time"
  | "vibrato";
export interface Settings {
  feedback: number;
  glide: number;
  mix: number;
  resonance: number;
  time: number;
  vibrato: number;
  wave: Wave;
}

export const DEFAULTS: Settings & { volume: number } = {
  feedback: 4,
  glide: 3,
  mix: 3,
  resonance: 4,
  time: 5,
  vibrato: 2,
  volume: 7,
  wave: "Saw",
};

const OSC_TYPES: Record<Wave, OscillatorType> = {
  Saw: "sawtooth",
  Square: "square",
  Tri: "triangle",
};
const DETUNE_CENTS = 7;
const SMOOTHING = 0.02;
/** What the voice adds before the filter, so the resonance and the echo stay under the bus's limiter. */
const SOURCE_GAIN = 0.22;
const LEVEL = 0.8;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;
const VIBRATO_HERTZ = 5.4;

const unit = (value: number) => value / 10;
const hertz = (semitones: number) => 440 * 2 ** ((ROOT + semitones - 69) / 12);

/** The cutoff for a height on the plate, from 0 to 100: low at the bottom, bright at the top. */
export const cutoffHertz = (height: number) => 150 * 90 ** (height / 100);
export const resonanceDecibels = (value: number) => unit(value) * 16;
export const glideSeconds = (value: number) => unit(value) ** 2 * 0.5;
export const vibratoCents = (value: number) => unit(value) ** 2 * 60;
export const delaySeconds = (value: number) => 0.08 + unit(value) * 0.62;
export const feedbackGain = (value: number) => unit(value) * 0.75;
export const mixGain = (value: number) => unit(value) * 0.9;

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

interface Graph {
  amp: GainNode;
  ctx: BaseAudioContext;
  delay: DelayNode;
  feedback: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  mix: GainNode;
  oscillators: OscillatorNode[];
}

export function createPulsarEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;
  /** How long a pitch takes to arrive, taken at the last move: the glide knob can be turned while a note holds. */
  let lastPitch = 12;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function applyAll() {
    if (!graph) {
      return;
    }
    smooth(graph.filter.Q, resonanceDecibels(settings.resonance));
    smooth(graph.lfoDepth.gain, vibratoCents(settings.vibrato));
    smooth(graph.delay.delayTime, delaySeconds(settings.time));
    smooth(graph.feedback.gain, feedbackGain(settings.feedback));
    smooth(graph.mix.gain, mixGain(settings.mix));
    for (const [index, osc] of graph.oscillators.entries()) {
      if (index < 2) {
        osc.type = OSC_TYPES[settings.wave];
      }
    }
  }

  return {
    /** Builds the voice and its echo into `destination` (the bus): nothing sounds until the gate opens. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const first = ctx.createOscillator();
      const second = ctx.createOscillator();
      const sub = ctx.createOscillator();
      first.detune.value = -DETUNE_CENTS;
      second.detune.value = DETUNE_CENTS;
      sub.type = "square";
      for (const osc of [first, second, sub]) {
        osc.frequency.value = hertz(lastPitch);
      }
      sub.frequency.value = hertz(lastPitch) / 2;
      const sources = ctx.createGain();
      sources.gain.value = SOURCE_GAIN;
      first.connect(sources);
      second.connect(sources);
      const subLevel = ctx.createGain();
      subLevel.gain.value = 0.5;
      sub.connect(subLevel).connect(sources);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoffHertz(60);
      const amp = ctx.createGain();
      amp.gain.value = 0;
      sources.connect(filter).connect(amp);

      // The vibrato sways every oscillator's pitch together.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = VIBRATO_HERTZ;
      const lfoDepth = ctx.createGain();
      lfo.connect(lfoDepth);
      for (const osc of [first, second, sub]) {
        lfoDepth.connect(osc.detune);
      }

      // The echo: the repeats come back darker, through a low-pass in the loop.
      const delay = ctx.createDelay(1);
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2800;
      const feedback = ctx.createGain();
      const mix = ctx.createGain();
      amp.connect(destination);
      amp.connect(delay);
      delay.connect(damp).connect(feedback).connect(delay);
      damp.connect(mix).connect(destination);

      for (const osc of [first, second, sub, lfo]) {
        osc.start();
      }
      graph = {
        amp,
        ctx,
        delay,
        feedback,
        filter,
        lfo,
        lfoDepth,
        mix,
        oscillators: [first, second, sub],
      };
      first.type = OSC_TYPES[settings.wave];
      second.type = OSC_TYPES[settings.wave];
      delay.delayTime.value = delaySeconds(settings.time);
      feedback.gain.value = feedbackGain(settings.feedback);
      mix.gain.value = mixGain(settings.mix);
      filter.Q.value = resonanceDecibels(settings.resonance);
      lfoDepth.gain.value = vibratoCents(settings.vibrato);
    },
    /** Stops every oscillator and disconnects what this voice made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      if (graph) {
        for (const osc of [...graph.oscillators, graph.lfo]) {
          osc.stop();
        }
        graph.amp.disconnect();
        graph.mix.disconnect();
      }
      graph = null;
    },
    /** Opens or closes the voice: the touch. A new touch wakes the shared context; the promise is not awaited. */
    gate(open: boolean) {
      if (!graph) {
        return;
      }
      const { amp, ctx } = graph;
      if (open && ctx.state === "suspended" && "resume" in ctx) {
        (ctx as AudioContext).resume().catch(() => undefined);
        if (!unlock) {
          unlock = () => {
            (ctx as AudioContext).resume().catch(() => undefined);
          };
          document.addEventListener("pointerup", unlock, { once: true });
        }
      }
      amp.gain.setTargetAtTime(
        open ? LEVEL : 0,
        ctx.currentTime,
        open ? 0.008 : 0.06
      );
    },
    /** Moves the pitch, in semitones above the root: it glides there over the glide time. */
    pitch(semitones: number) {
      lastPitch = semitones;
      if (!graph) {
        return;
      }
      const frequency = hertz(semitones);
      const time = Math.max(0.004, glideSeconds(settings.glide) / 3);
      const now = graph.ctx.currentTime;
      graph.oscillators[0]?.frequency.setTargetAtTime(frequency, now, time);
      graph.oscillators[1]?.frequency.setTargetAtTime(frequency, now, time);
      graph.oscillators[2]?.frequency.setTargetAtTime(frequency / 2, now, time);
    },
    /** The height on the plate, from 0 to 100, opens the filter. */
    brightness(height: number) {
      if (graph) {
        smooth(graph.filter.frequency, cutoffHertz(height));
      }
    },
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      settings[key] = value;
      applyAll();
    },
  };
}

export type PulsarEngine = ReturnType<typeof createPulsarEngine>;
