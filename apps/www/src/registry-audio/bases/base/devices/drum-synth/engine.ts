import type { InstrumentBinding } from "@audio-ui/core/device";
import {
  type DrumSynthNote,
  type DrumSynthState,
  type DrumSynthVoice,
  decaySeconds,
  toneRatio,
  tuneRatio,
  volumeGain,
} from "@/registry-audio/bases/base/devices/drum-synth/device";

/** How long the noise every hit reads from lasts, in seconds: each hit starts somewhere in it, so no two sound the same. */
const NOISE_SECONDS = 2;
/** Where a hit's envelope ends, near silence, so the ramp down is exponential all the way. */
const FLOOR = 0.0001;
const SMOOTHING = 0.03;

export interface DrumSynthEngine
  extends InstrumentBinding<DrumSynthState, DrumSynthNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

/** White noise, made once per context and shared by every hit. */
const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseOf(ctx: BaseAudioContext): AudioBuffer {
  const kept = noises.get(ctx);
  if (kept) {
    return kept;
  }
  const length = Math.ceil(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  noises.set(ctx, buffer);
  return buffer;
}

/** A hit's level falling from `level` at `time` to silence over `decay` seconds, into `into`. */
function envelope(
  ctx: BaseAudioContext,
  into: AudioNode,
  time: number,
  level: number,
  decay: number
) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(FLOOR, level), time);
  gain.gain.exponentialRampToValueAtTime(FLOOR, time + decay);
  gain.connect(into);
  return gain;
}

/** Noise through a filter, `decay` seconds long from `time`. */
function noiseHit(
  ctx: BaseAudioContext,
  into: AudioNode,
  time: number,
  {
    decay,
    frequency,
    level,
    type,
  }: {
    decay: number;
    frequency: number;
    level: number;
    type: BiquadFilterType;
  }
) {
  const length = Math.min(NOISE_SECONDS, decay + 0.02);
  const source = ctx.createBufferSource();
  source.buffer = noiseOf(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = Math.min(ctx.sampleRate / 2 - 100, frequency);
  const gain = envelope(ctx, into, time, level, decay);
  source.connect(filter).connect(gain);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  source.start(time, Math.random() * (NOISE_SECONDS - length), length);
}

/** A tone whose pitch falls from `sweep` times `frequency` to it over `drop` seconds, `decay` seconds long from `time`. */
function toneHit(
  ctx: BaseAudioContext,
  into: AudioNode,
  time: number,
  {
    decay,
    drop,
    frequency,
    level,
    sweep,
    type = "sine",
  }: {
    decay: number;
    drop: number;
    frequency: number;
    level: number;
    sweep: number;
    type?: OscillatorType;
  }
) {
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency * sweep, time);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, time + drop);
  const gain = envelope(ctx, into, time, level, decay);
  oscillator.connect(gain);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(time);
  oscillator.stop(time + decay + 0.02);
}

/** What shapes a hit: the state's controls, read for this voice, and the velocity. */
interface Shape {
  decay: number;
  snap: number;
  tone: number;
  tune: number;
  velocity: number;
}

/** Each voice, at the middle of its controls, as the arrangement demo's drums were drawn. */
const VOICES: Record<
  DrumSynthVoice,
  (ctx: BaseAudioContext, into: AudioNode, time: number, shape: Shape) => void
> = {
  clap: (ctx, into, time, { decay, snap, tone, tune, velocity }) => {
    const frequency = 1100 * tune * tone * (0.75 + 0.25 * velocity);
    // More snap, more hands before the clap: none at the middle, two at the top.
    const hands = Math.round(Math.max(0, snap - 0.5) * 4);
    for (let hand = 0; hand < hands; hand += 1) {
      noiseHit(ctx, into, time + hand * 0.01, {
        decay: 0.01,
        frequency,
        level: 0.35 * velocity,
        type: "bandpass",
      });
    }
    noiseHit(ctx, into, time + 0.008 + hands * 0.01, {
      decay,
      frequency,
      level: 0.35 * velocity,
      type: "bandpass",
    });
  },
  cymbal: (ctx, into, time, { decay, tone, tune, velocity }) =>
    noiseHit(ctx, into, time, {
      decay,
      frequency: 4500 * tune * tone * (0.75 + 0.25 * velocity),
      level: 0.16 * velocity,
      type: "highpass",
    }),
  hat: (ctx, into, time, { decay, tone, tune, velocity }) =>
    noiseHit(ctx, into, time, {
      // A softer hit is shorter as well as quieter, as a stick barely touching it.
      decay: decay * (0.5 + 0.5 * velocity),
      frequency: 7000 * tune * tone * (0.75 + 0.25 * velocity),
      level: 0.2 * velocity,
      type: "highpass",
    }),
  kick: (ctx, into, time, { decay, snap, tone, tune, velocity }) => {
    toneHit(ctx, into, time, {
      decay,
      drop: 0.06,
      frequency: 50 * tune,
      level: 0.9 * velocity,
      sweep: 1 + 3 * snap * (0.8 + 0.2 * velocity),
    });
    // Past the middle, the tone adds the beater's click.
    if (tone > 1) {
      noiseHit(ctx, into, time, {
        decay: 0.012,
        frequency: 3000,
        level: 0.3 * Math.min(1, tone - 1) * velocity,
        type: "highpass",
      });
    }
  },
  "open-hat": (ctx, into, time, { decay, tone, tune, velocity }) =>
    noiseHit(ctx, into, time, {
      decay,
      frequency: 7000 * tune * tone * (0.75 + 0.25 * velocity),
      level: 0.14 * velocity,
      type: "highpass",
    }),
  rim: (ctx, into, time, { decay, snap, tone, tune, velocity }) => {
    toneHit(ctx, into, time, {
      decay: decay * 0.75,
      drop: 0.005,
      frequency: 800 * tune,
      level: 0.3 * velocity,
      sweep: 1.5,
      type: "triangle",
    });
    noiseHit(ctx, into, time, {
      decay,
      frequency: 2500 * tune * tone,
      level: 0.6 * snap * velocity,
      type: "bandpass",
    });
  },
  snare: (ctx, into, time, { decay, snap, tone, tune, velocity }) => {
    // The snap sets the wires' rattle against the drum's body: even at the middle.
    noiseHit(ctx, into, time, {
      decay,
      frequency: 1500 * tune * tone * (0.75 + 0.25 * velocity),
      level: 0.5 * velocity * 2 * snap,
      type: "bandpass",
    });
    toneHit(ctx, into, time, {
      decay: decay * (0.08 / 0.18),
      drop: 0.06,
      frequency: 180 * tune,
      level: 0.3 * velocity * 2 * (1 - snap),
      sweep: 2.5,
    });
  },
  tom: (ctx, into, time, { decay, snap, tune, velocity }) =>
    toneHit(ctx, into, time, {
      decay,
      drop: 0.08,
      frequency: 110 * tune,
      level: 0.8 * velocity,
      sweep: 1 + snap,
    }),
};

/**
 * The Drum Synth on the Web Audio API, for a `DrumSynthState`:
 *
 * ```
 * each hit (a falling sine, filtered noise, or both) → output (volume)
 * ```
 *
 * One engine plays every hit: each is made when it comes, from the state at
 * that moment, and rings for its decay whatever the note's length, so a note
 * off lets nothing go. A drum rack chokes a pad by its own gain. The volume
 * moves what rings; the other controls take the next hit.
 */
export function createDrumSynthEngine(
  ctx: BaseAudioContext,
  initial: DrumSynthState
): DrumSynthEngine {
  let state = initial;
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume);

  return {
    dispose: () => output.disconnect(),
    // A drum rings for its decay, whatever the note's length.
    noteOff: () => undefined,
    noteOn: (note, { at } = {}) => {
      const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
      if (velocity <= 0) {
        return;
      }
      VOICES[state.voice](ctx, output, Math.max(ctx.currentTime, at ?? 0), {
        decay: decaySeconds(state.voice, state.decay),
        snap: state.snap / 10,
        tone: toneRatio(state.tone),
        tune: tuneRatio(state.tune),
        velocity,
      });
    },
    output,
    update: (next) => {
      state = next;
      output.gain.setTargetAtTime(
        volumeGain(next.volume),
        ctx.currentTime,
        SMOOTHING
      );
    },
  };
}
