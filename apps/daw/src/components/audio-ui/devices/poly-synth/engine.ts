import type { InstrumentBinding, NoteTiming } from "@audio-ui/engine/device";
import {
  attackSeconds,
  contourCents,
  cutoffHertz,
  decaySeconds,
  type PolySynthNote,
  type PolySynthState,
  pulseWidth,
  rateHertz,
  releaseSeconds,
  resonanceDecibels,
  vibratoCents,
  volumeGain,
} from "@/components/audio-ui/devices/poly-synth/device";

/** What each source adds before the filter: with the resonance, a chord of voices stays under full scale. */
const SOURCE_GAIN = 0.1;
/** What a voice is lifted by on its way out, +12 dB: a voice plays alone, where a whole synth summed eight. A chord of eight stays under full scale. */
const VOICE_GAIN = 4;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
/** The softest note still sounds: a velocity of 0 is this share of a full one. */
const MIN_LEVEL = 0.25;
const NOISE_SECONDS = 2;
const HARMONICS = 96;
const MIDDLE_C = 261.63;
/** How long a voice rings after its release starts, as releases. */
const RELEASE_TAIL = 1.4;

/** What each chorus setting does: how fast the delay sweeps, how far, and how much of it is heard. */
const CHORUS = {
  I: { depth: 0.0018, rate: 0.5, wet: 0.65 },
  II: { depth: 0.0026, rate: 0.83, wet: 0.7 },
  Off: { depth: 0.0018, rate: 0.5, wet: 0 },
} as const;

export interface PolySynthEngine
  extends InstrumentBinding<PolySynthState, PolySynthNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface Voice {
  amp: GainNode;
  filter: BiquadFilterNode;
  frequency: number;
  id: NoteTiming["id"];
  /** The level its envelope rises to. */
  level: number;
  mixes: Record<"noise" | "pulse" | "saw" | "sub", GainNode>;
  oscillators: OscillatorNode[];
  pulse: OscillatorNode;
  source: AudioBufferSourceNode;
  start: number;
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

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, made once per context and shared by every voice. */
function noiseOf(ctx: BaseAudioContext) {
  const kept = noises.get(ctx);
  if (kept) {
    return kept;
  }
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * NOISE_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  noises.set(ctx, buffer);
  return buffer;
}

/**
 * Where an envelope that heads for `peak` over the attack, then for
 * `peak * sustain` over the decay, stands `elapsed` seconds in: the same
 * curves the engine schedules, so a release starts from where it got to.
 */
function envelopeAt(
  state: PolySynthState,
  peak: number,
  elapsed: number
): number {
  const attack = attackSeconds(state.attack);
  if (elapsed < attack) {
    return peak * (1 - Math.exp(-elapsed / (attack / 4)));
  }
  const reached = peak * (1 - Math.exp(-4));
  const settled = peak * (state.sustain / 10);
  const decay = decaySeconds(state.decay);
  return (
    settled + (reached - settled) * Math.exp(-(elapsed - attack) / (decay / 3))
  );
}

/**
 * One voice of the Poly Synth on the Web Audio API, for a `PolySynthState`:
 *
 * ```
 * saw, pulse, sub, noise → low-pass filter → amp → dry ───────────┐
 *   (vibrato on pitch)      (envelope, key     (envelope)          ├→ output (volume)
 *                            follow)                 └→ chorus → wet┘
 * ```
 *
 * A host plays chords with several of them, one note each. A note heads for
 * its level over the attack, then for the sustain over the decay; the filter
 * opens by the envelope amount on the same curves, and its cutoff follows the
 * pitch by the key follow. Let go, both fall back over the release from where
 * they had got to. A note while one is held glides the voice to it. Every
 * control moves with a ramp, and a held note follows the ones that shape it.
 */
export function createPolySynthEngine(
  ctx: BaseAudioContext,
  initial: PolySynthState
): PolySynthEngine {
  let state = initial;
  let voice: Voice | null = null;

  const smooth = (param: AudioParam, value: number, at = ctx.currentTime) =>
    param.setTargetAtTime(value, at, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);
  const cutoffFor = (frequency: number) =>
    cutoffHertz(state.cutoff) * (frequency / MIDDLE_C) ** (state.keys / 10);

  // What every note goes through: the vibrato, the chorus and the volume.
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * VOICE_GAIN;
  const bus = ctx.createGain();
  const dry = ctx.createGain();
  bus.connect(dry).connect(output);
  const left = ctx.createDelay(0.05);
  const right = ctx.createDelay(0.05);
  left.delayTime.value = 0.0065;
  right.delayTime.value = 0.0065;
  const merger = ctx.createChannelMerger(2);
  bus.connect(left).connect(merger, 0, 0);
  bus.connect(right).connect(merger, 0, 1);
  const wet = ctx.createGain();
  wet.gain.value = CHORUS[initial.chorus].wet;
  merger.connect(wet).connect(output);
  const chorusLfo = ctx.createOscillator();
  chorusLfo.type = "triangle";
  chorusLfo.frequency.value = CHORUS[initial.chorus].rate;
  const depthLeft = ctx.createGain();
  const depthRight = ctx.createGain();
  depthLeft.gain.value = CHORUS[initial.chorus].depth;
  depthRight.gain.value = -CHORUS[initial.chorus].depth;
  chorusLfo.connect(depthLeft).connect(left.delayTime);
  chorusLfo.connect(depthRight).connect(right.delayTime);
  chorusLfo.start();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rateHertz(initial.rate);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = vibratoCents(initial.vibrato);
  lfo.connect(lfoDepth);
  lfo.start();

  const release = (held: Voice, time: number) => {
    const seconds = releaseSeconds(state.release);
    const elapsed = time - held.start;
    const reached = envelopeAt(state, 1, elapsed);
    held.amp.gain.cancelScheduledValues(time);
    held.amp.gain.setValueAtTime(held.level * reached, time);
    held.amp.gain.setTargetAtTime(0, time, seconds / 4);
    held.filter.detune.cancelScheduledValues(time);
    held.filter.detune.setValueAtTime(
      contourCents(state.contour) * reached,
      time
    );
    held.filter.detune.setTargetAtTime(0, time, seconds / 4);
    const end = time + seconds * RELEASE_TAIL + 0.05;
    for (const oscillator of held.oscillators) {
      oscillator.stop(end);
    }
    held.source.stop(end);
  };

  const start = (note: PolySynthNote, id: Voice["id"], time: number): Voice => {
    const { frequency } = note;
    const level =
      MIN_LEVEL +
      (1 - MIN_LEVEL) * Math.min(1, Math.max(0, note.velocity ?? 1));
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    const pulse = ctx.createOscillator();
    pulse.setPeriodicWave(pulseWave(ctx, pulseWidth(state.width)));
    const sub = ctx.createOscillator();
    sub.type = "square";
    for (const [oscillator, pitch] of [
      [saw, frequency],
      [pulse, frequency],
      [sub, frequency / 2],
    ] as const) {
      oscillator.frequency.setValueAtTime(pitch, time);
      lfoDepth.connect(oscillator.detune);
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseOf(ctx);
    source.loop = true;
    const mixes = {
      noise: ctx.createGain(),
      pulse: ctx.createGain(),
      saw: ctx.createGain(),
      sub: ctx.createGain(),
    };
    for (const part of ["noise", "pulse", "saw", "sub"] as const) {
      mixes[part].gain.value = (state[part] / 10) * SOURCE_GAIN;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoffFor(frequency), time);
    filter.Q.setValueAtTime(resonanceDecibels(state.resonance), time);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    saw.connect(mixes.saw).connect(filter);
    pulse.connect(mixes.pulse).connect(filter);
    sub.connect(mixes.sub).connect(filter);
    source.connect(mixes.noise).connect(filter);
    filter.connect(amp).connect(bus);
    // The envelope opens the amplifier and the filter together.
    const attack = attackSeconds(state.attack);
    const decay = decaySeconds(state.decay);
    const sustain = state.sustain / 10;
    const contour = contourCents(state.contour);
    amp.gain.setTargetAtTime(level, time, attack / 4);
    amp.gain.setTargetAtTime(level * sustain, time + attack, decay / 3);
    filter.detune.setValueAtTime(0, time);
    filter.detune.setTargetAtTime(contour, time, attack / 4);
    filter.detune.setTargetAtTime(contour * sustain, time + attack, decay / 3);
    const oscillators = [saw, pulse, sub];
    saw.onended = () => {
      for (const oscillator of oscillators) {
        lfoDepth.disconnect(oscillator.detune);
        oscillator.disconnect();
      }
      source.disconnect();
      for (const mix of Object.values(mixes)) {
        mix.disconnect();
      }
      filter.disconnect();
      amp.disconnect();
    };
    for (const oscillator of oscillators) {
      oscillator.start(time);
    }
    source.start(time);
    return {
      amp,
      filter,
      frequency,
      id,
      level,
      mixes,
      oscillators,
      pulse,
      source,
      start: time,
    };
  };

  return {
    dispose: () => {
      if (voice) {
        for (const oscillator of voice.oscillators) {
          oscillator.stop();
        }
        voice.source.stop();
      }
      voice = null;
      lfo.stop();
      chorusLfo.stop();
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
        const [saw, pulse, sub] = voice.oscillators;
        for (const [oscillator, pitch] of [
          [saw, note.frequency],
          [pulse, note.frequency],
          [sub, note.frequency / 2],
        ] as const) {
          if (oscillator) {
            smooth(oscillator.frequency, pitch, time);
          }
        }
        voice.frequency = note.frequency;
        smooth(voice.filter.frequency, cutoffFor(note.frequency), time);
        voice.id = id;
        return;
      }
      voice = start(note, id, time);
    },
    output,
    update: (next) => {
      const previous = state;
      state = next;
      smooth(output.gain, volumeGain(next.volume) * VOICE_GAIN);
      smooth(lfo.frequency, rateHertz(next.rate));
      smooth(lfoDepth.gain, vibratoCents(next.vibrato));
      const chorus = CHORUS[next.chorus];
      smooth(chorusLfo.frequency, chorus.rate);
      smooth(depthLeft.gain, chorus.depth);
      smooth(depthRight.gain, -chorus.depth);
      smooth(wet.gain, chorus.wet);
      if (!voice) {
        return;
      }
      for (const part of ["noise", "pulse", "saw", "sub"] as const) {
        smooth(voice.mixes[part].gain, (next[part] / 10) * SOURCE_GAIN);
      }
      smooth(voice.filter.frequency, cutoffFor(voice.frequency));
      smooth(voice.filter.Q, resonanceDecibels(next.resonance));
      if (previous.width !== next.width) {
        voice.pulse.setPeriodicWave(pulseWave(ctx, pulseWidth(next.width)));
      }
    },
  };
}
