import type { NoteTiming } from "@audio-ui/engine/device";
import { type InstrumentEngine, noiseBuffer } from "@audio-ui/engine/device";
import {
  attackSeconds,
  contourCents,
  cutoffHertz,
  decaySeconds,
  depthCents,
  glideSeconds,
  type MonoSynthNote,
  type MonoSynthState,
  pulseWidth,
  RANGE_OCTAVES,
  rateHertz,
  releaseSeconds,
  resonanceDecibels,
  tuneCents,
  volumeGain,
} from "@/components/audio-ui/devices/mono-synth/device";

/** What each source adds before the filter: with the resonance, the loudest sound stays under full scale. */
const SOURCE_GAIN = 0.2;
/** What the synth is lifted by on its way out, +6 dB: as loud as the registry's other instruments for the same volume. */
const OUTPUT_GAIN = 2;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
/** The softest note still sounds: a velocity of 0 is this share of a full one. */
const MIN_LEVEL = 0.25;
const HARMONICS = 96;

export type MonoSynthEngine = InstrumentEngine<MonoSynthState, MonoSynthNote>;

/**
 * A curve an envelope follows from `start`: from `from` towards `target`, and
 * from `next.at` towards the next target. What the engine schedules, kept so
 * that a later note starts from where the last one got to, at any time.
 */
interface Curve {
  from: number;
  next?: { at: number; target: number; tau: number };
  start: number;
  target: number;
  tau: number;
}

const approach = (from: number, target: number, tau: number, elapsed: number) =>
  target + (from - target) * Math.exp(-Math.max(0, elapsed) / tau);

/** Where a curve stands at `time`. */
function valueAt(curve: Curve, time: number) {
  const { next } = curve;
  if (next && time >= next.at) {
    const reached = approach(
      curve.from,
      curve.target,
      curve.tau,
      next.at - curve.start
    );
    return approach(reached, next.target, next.tau, time - next.at);
  }
  return approach(curve.from, curve.target, curve.tau, time - curve.start);
}

function schedule(param: AudioParam, curve: Curve) {
  param.cancelScheduledValues(curve.start);
  param.setValueAtTime(curve.from, curve.start);
  param.setTargetAtTime(curve.target, curve.start, curve.tau);
  if (curve.next) {
    param.setTargetAtTime(curve.next.target, curve.next.at, curve.next.tau);
  }
}

/** A pulse wave of the given duty, from its Fourier series: the browser has no pulse oscillator. */
function pulseWave(ctx: BaseAudioContext, duty: number) {
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let n = 1; n < HARMONICS; n += 1) {
    const k = 2 / (n * Math.PI);
    real[n] = k * Math.sin(2 * Math.PI * n * duty);
    imag[n] = k * (1 - Math.cos(2 * Math.PI * n * duty));
  }
  return ctx.createPeriodicWave(real, imag);
}

/**
 * The Mono Synth on the Web Audio API, for a `MonoSynthState`: the whole
 * synth, one note at a time.
 *
 * ```
 * oscillator, sub, noise → low-pass filter → amp → output (volume)
 *   (vibrato on pitch)      (envelope)         (envelope)
 * ```
 *
 * A host gives it every note it plays, each by its id. The first note opens
 * the amplifier and the filter along the envelope; a note while one is held
 * glides the pitch to it over the glide and leaves the envelope as it is, and
 * letting go of the last note played glides back to the one still held. Let
 * go of every note, both fall back over the release from where they had got
 * to. Every control moves with a ramp, a held note included.
 */
export function createMonoSynthEngine(
  ctx: BaseAudioContext,
  initial: MonoSynthState
): MonoSynthEngine {
  let state = initial;
  /** The notes held, the one heard last. */
  const held: { frequency: number; id: NoteTiming["id"] }[] = [];
  let amp: Curve = { from: 0, start: 0, target: 0, tau: 1 };
  let contour: Curve = { from: 0, start: 0, target: 0, tau: 1 };

  const smooth = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);

  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * OUTPUT_GAIN;
  const gate = ctx.createGain();
  gate.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoffHertz(initial.cutoff);
  filter.Q.value = resonanceDecibels(initial.resonance);
  filter.connect(gate).connect(output);
  const mix = (level: number) => {
    const node = ctx.createGain();
    node.gain.value = (level / 10) * SOURCE_GAIN;
    node.connect(filter);
    return node;
  };
  const mixes = {
    noise: mix(initial.noise),
    osc: mix(initial.osc),
    sub: mix(initial.sub),
  };
  const oscillator = ctx.createOscillator();
  const sub = ctx.createOscillator();
  sub.type = "square";
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  noise.loop = true;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rateHertz(initial.rate);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = depthCents(initial.depth);
  lfo.connect(lfoDepth);
  for (const source of [oscillator, sub]) {
    source.detune.value = tuneCents(initial.tune);
    lfoDepth.connect(source.detune);
  }
  oscillator.connect(mixes.osc);
  sub.connect(mixes.sub);
  noise.connect(mixes.noise);

  const shape = () => {
    if (state.wave === "square") {
      oscillator.setPeriodicWave(pulseWave(ctx, pulseWidth(state.width)));
    } else {
      oscillator.type = state.wave === "triangle" ? "triangle" : "sawtooth";
    }
  };
  shape();
  const sources = [oscillator, sub, noise, lfo];
  for (const source of sources) {
    source.start();
  }

  /** The oscillator and the sub, an octave under it, to a pitch: at once, or over `glide` seconds. */
  const pitchTo = (frequency: number, time: number, glide: number) => {
    const pitch = frequency * 2 ** RANGE_OCTAVES[state.range];
    for (const [source, hertz] of [
      [oscillator, pitch],
      [sub, pitch / 2],
    ] as const) {
      source.frequency.cancelScheduledValues(time);
      if (glide > 0) {
        source.frequency.setTargetAtTime(hertz, time, glide / 3);
      } else {
        source.frequency.setValueAtTime(hertz, time);
      }
    }
  };

  /** The envelope opens the amplifier and the filter together, from where they are, to `level`. */
  const open = (level: number, time: number) => {
    const attack = attackSeconds(state.attack);
    const decay = decaySeconds(state.decay);
    const sustain = state.sustain / 10;
    const curve = (from: Curve, peak: number): Curve => ({
      from: valueAt(from, time),
      start: time,
      target: peak,
      tau: attack / 4,
      next: { at: time + attack, target: peak * sustain, tau: decay / 3 },
    });
    amp = curve(amp, level);
    contour = curve(contour, contourCents(state.contour));
    schedule(gate.gain, amp);
    schedule(filter.detune, contour);
  };

  const close = (time: number) => {
    const tau = releaseSeconds(state.release) / 4;
    const curve = (from: Curve): Curve => ({
      from: valueAt(from, time),
      start: time,
      target: 0,
      tau,
    });
    amp = curve(amp);
    contour = curve(contour);
    schedule(gate.gain, amp);
    schedule(filter.detune, contour);
  };

  return {
    dispose: () => {
      for (const source of sources) {
        source.stop();
        source.disconnect();
      }
      held.length = 0;
      output.disconnect();
    },
    noteOff: ({ at, id } = {}) => {
      const heard = held.at(-1);
      if (!heard) {
        return;
      }
      // With no id, every note is let go.
      if (id === undefined) {
        held.length = 0;
      } else {
        const index = held.findIndex((note) => note.id === id);
        if (index === -1) {
          return;
        }
        held.splice(index, 1);
      }
      const time = when(at);
      const back = held.at(-1);
      if (!back) {
        close(time);
      } else if (back !== heard) {
        pitchTo(back.frequency, time, glideSeconds(state.glide));
      }
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      const legato = held.length > 0;
      const again = held.findIndex((item) => item.id === id);
      if (id !== undefined && again !== -1) {
        held.splice(again, 1);
      }
      held.push({ frequency: note.frequency, id });
      pitchTo(note.frequency, time, legato ? glideSeconds(state.glide) : 0);
      if (!legato) {
        const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
        open(MIN_LEVEL + (1 - MIN_LEVEL) * velocity, time);
      }
    },
    output,
    update: (next) => {
      const previous = state;
      state = next;
      smooth(output.gain, volumeGain(next.volume) * OUTPUT_GAIN);
      smooth(mixes.osc.gain, (next.osc / 10) * SOURCE_GAIN);
      smooth(mixes.sub.gain, (next.sub / 10) * SOURCE_GAIN);
      smooth(mixes.noise.gain, (next.noise / 10) * SOURCE_GAIN);
      smooth(filter.frequency, cutoffHertz(next.cutoff));
      smooth(filter.Q, resonanceDecibels(next.resonance));
      smooth(oscillator.detune, tuneCents(next.tune));
      smooth(sub.detune, tuneCents(next.tune));
      smooth(lfo.frequency, rateHertz(next.rate));
      smooth(lfoDepth.gain, depthCents(next.depth));
      if (
        previous.wave !== next.wave ||
        (next.wave === "square" && previous.width !== next.width)
      ) {
        shape();
      }
      // A held note follows the range the moment it changes.
      const heard = held.at(-1);
      if (heard && previous.range !== next.range) {
        pitchTo(heard.frequency, ctx.currentTime, 0);
      }
    },
  };
}
