import type { InstrumentBinding, NoteTiming } from "@audio-ui/core/device";
import {
  cutoffHertz,
  releaseSeconds,
  SAMPLER_SLICES,
  type SamplerNote,
  type SamplerState,
  sliceOf,
  volumeGain,
} from "@/registry-audio/bases/base/lib/sampler-device";

/*
 * The samples the sampler comes with: short loops made here with oscillators
 * and noise, rendered once into a buffer the way a file would be decoded, and
 * shared by every voice. A sample is two bars cut into sixteen equal slices,
 * so each slice lands on an eighth note of the loop.
 */

interface Sample {
  bpm: number;
  name: string;
  /** Plays the loop's notes into `ctx`; the loop is `BEATS` beats long. */
  render: (ctx: OfflineAudioContext, beat: number) => void;
}

const RATE = 44_100;
const BEATS = 8;
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** A sine with a falling envelope: one partial of a key. */
function partial(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    frequency,
    level,
  }: { at: number; decay: number; frequency: number; level: number }
) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

function noise(
  ctx: OfflineAudioContext,
  out: AudioNode,
  {
    at,
    decay,
    filter,
    level,
  }: {
    at: number;
    decay: number;
    filter: { frequency: number; type: BiquadFilterType };
    level: number;
  }
) {
  const buffer = ctx.createBuffer(1, Math.ceil(RATE * (decay + 0.02)), RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter.type;
  biquad.frequency.value = filter.frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(biquad).connect(gain).connect(out);
  source.start(at);
}

const CHORDS: { at: number; notes: number[] }[] = [
  { at: 0, notes: [57, 60, 64, 67] },
  { at: 2, notes: [53, 57, 60, 64] },
  { at: 4, notes: [50, 53, 57, 60] },
  { at: 6, notes: [52, 56, 59, 62] },
];

/** The samples the sampler comes with, by the value its `sample` parameter takes. */
const SAMPLES: Readonly<Record<string, Sample>> = {
  "dusty-keys": {
    bpm: 88,
    name: "Dusty keys",
    render(ctx, beat) {
      const out = ctx.createGain();
      out.gain.value = 0.5;
      out.connect(ctx.destination);
      // Electric piano chords, twice a chord: the full stab and a soft one after it.
      for (const chord of CHORDS) {
        for (const [stab, level] of [
          [0, 1],
          [1.5, 0.45],
        ] as const) {
          for (const [index, note] of chord.notes.entries()) {
            const at = (chord.at + stab) * beat + index * 0.014;
            const base = hertz(note);
            partial(ctx, out, {
              at,
              decay: 1.1 * level + 0.3,
              frequency: base,
              level: 0.16 * level,
            });
            partial(ctx, out, {
              at,
              decay: 0.35,
              frequency: base * 2,
              level: 0.06 * level,
            });
            partial(ctx, out, {
              at,
              decay: 0.12,
              frequency: base * 4.01,
              level: 0.03 * level,
            });
          }
        }
      }
      // A kick on the one and the and-of-two, a snare on two and four, hats on the eighths.
      for (const at of [0, 2.5, 4, 6.5]) {
        const kick = ctx.createOscillator();
        kick.frequency.setValueAtTime(140, at * beat);
        kick.frequency.exponentialRampToValueAtTime(48, at * beat + 0.05);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.9, at * beat);
        gain.gain.exponentialRampToValueAtTime(0.0001, at * beat + 0.3);
        kick.connect(gain).connect(out);
        kick.start(at * beat);
        kick.stop(at * beat + 0.35);
      }
      for (const at of [1, 3, 5, 7]) {
        noise(ctx, out, {
          at: at * beat,
          decay: 0.16,
          filter: { frequency: 1800, type: "highpass" },
          level: 0.5,
        });
        partial(ctx, out, {
          at: at * beat,
          decay: 0.08,
          frequency: 190,
          level: 0.4,
        });
      }
      for (let eighth = 0; eighth < BEATS * 2; eighth += 1) {
        noise(ctx, out, {
          at: eighth * 0.5 * beat,
          decay: 0.04,
          filter: { frequency: 8000, type: "highpass" },
          level: eighth % 2 ? 0.1 : 0.18,
        });
      }
      // The dust of an old record under all of it.
      noise(ctx, out, {
        at: 0,
        decay: BEATS * beat,
        filter: { frequency: 5000, type: "highpass" },
        level: 0.008,
      });
    },
  },
  "sub-line": {
    bpm: 96,
    name: "Sub line",
    render(ctx, beat) {
      const out = ctx.createGain();
      out.gain.value = 0.6;
      out.connect(ctx.destination);
      // Sixteen eighth notes of a bass line: every slice is a different note.
      const line = [
        33, 33, 36, 33, 40, 38, 36, 33, 31, 31, 35, 31, 38, 36, 35, 31,
      ];
      for (const [index, note] of line.entries()) {
        const at = index * 0.5 * beat;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(900, at);
        filter.frequency.exponentialRampToValueAtTime(160, at + 0.22);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.8, at + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.27);
        filter.connect(gain).connect(out);
        const saw = ctx.createOscillator();
        saw.type = "sawtooth";
        saw.frequency.value = hertz(note);
        saw.connect(filter);
        saw.start(at);
        saw.stop(at + 0.3);
        partial(ctx, out, {
          at,
          decay: 0.27,
          frequency: hertz(note),
          level: 0.5,
        });
      }
    },
  },
};

const rendered = new Map<string, Promise<AudioBuffer>>();

/** A sample the sampler comes with, rendered once and kept: every voice plays the same buffer. */
export function renderSamplerSample(name: string): Promise<AudioBuffer> {
  const kept = rendered.get(name);
  if (kept) {
    return kept;
  }
  const sample = SAMPLES[name] ?? SAMPLES["dusty-keys"];
  if (!sample) {
    return Promise.reject(new Error(`No sample ${name}`));
  }
  const beat = 60 / sample.bpm;
  let buffer: Promise<AudioBuffer>;
  try {
    const ctx = new OfflineAudioContext(
      2,
      Math.ceil(RATE * beat * BEATS),
      RATE
    );
    sample.render(ctx, beat);
    buffer = ctx.startRendering();
  } catch (error) {
    // Where there is no Web Audio to render with, the sampler waits for a file.
    buffer = Promise.reject(error);
  }
  rendered.set(name, buffer);
  return buffer;
}

const ATTACK = 0.003;
/** How fast a slice goes when a new one takes its voice. */
const CHOKE = 0.008;
/** Headroom: a few slices at once still leave room under full scale. */
const MIX_GAIN = 0.7;
const SMOOTHING = 0.02;
const pitchOf = (frequency: number) => 69 + 12 * Math.log2(frequency / 440);
const rate = (semitones: number) => 2 ** (semitones / 12);

export interface SamplerEngine
  extends InstrumentBinding<SamplerState, SamplerNote> {
  /**
   * Plays a file of your own in place of the sample the state names, until
   * the state names another; `null` goes back to the state's.
   */
  load: (buffer: AudioBuffer | null) => void;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the state's sample is rendered: a note before plays nothing. */
  readonly ready: Promise<boolean>;
}

interface Voice {
  env: GainNode;
  id: NoteTiming["id"];
  source: AudioBufferSourceNode;
  start: number;
  /** The level its envelope rose to. */
  velocity: number;
}

/**
 * One voice of the Sampler on the Web Audio API, for a `SamplerState`:
 *
 * ```
 * the sample, from its slice → tail fade → envelope → low-pass filter → output (volume)
 * ```
 *
 * A note plays the slice its pitch picks (`sliceOf`), at the pitch's
 * transposition, from its start for its length, rising in three milliseconds
 * and fading at its end so it never clicks. Struck, it plays to its end; with
 * the gate on, a note off closes it over the release. A note while one plays
 * cuts it and plays anew. A host plays several slices at once with several of
 * them, one note each.
 */
export function createSamplerEngine(
  ctx: BaseAudioContext,
  initial: SamplerState
): SamplerEngine {
  let state = initial;
  let voice: Voice | null = null;
  let own: AudioBuffer | null = null;
  let sample: AudioBuffer | null = null;
  let wanted = initial.sample;

  const smooth = (param: AudioParam, value: number, at = ctx.currentTime) =>
    param.setTargetAtTime(value, at, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoffHertz(initial.cutoff);
  filter.Q.value = 0.7;
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * MIX_GAIN;
  filter.connect(output);

  const fetch = (name: string) =>
    renderSamplerSample(name).then(
      (buffer) => {
        if (wanted === name) {
          sample = buffer;
        }
        return true;
      },
      () => false
    );
  const ready = fetch(initial.sample);

  const stop = (held: Voice, time: number, fall: number) => {
    const elapsed = time - held.start;
    const level = held.velocity * Math.min(1, Math.max(0, elapsed / ATTACK));
    held.env.gain.cancelScheduledValues(time);
    held.env.gain.setValueAtTime(level, time);
    held.env.gain.setTargetAtTime(0, time, fall / 4);
    held.source.stop(time + fall + 0.05);
  };

  const play = (note: SamplerNote, id: Voice["id"], time: number) => {
    const buffer = own ?? sample;
    if (!buffer) {
      return null;
    }
    const length = buffer.duration / SAMPLER_SLICES;
    const offset = sliceOf(pitchOf(note.frequency)) * length;
    const speed = rate(state.pitch);
    const lasts = length / speed;
    const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(speed, time);
    // A tail fade, so a slice ends without a click: apart from the envelope a gated key closes.
    const tail = ctx.createGain();
    const fade = Math.min(releaseSeconds(state.release), lasts / 2);
    tail.gain.setValueAtTime(1, time);
    tail.gain.setValueAtTime(1, time + lasts - fade);
    tail.gain.linearRampToValueAtTime(0, time + lasts);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(velocity, time + ATTACK);
    source.connect(tail).connect(env).connect(filter);
    source.onended = () => {
      source.disconnect();
      tail.disconnect();
      env.disconnect();
    };
    source.start(time, offset, length);
    return { env, id, source, start: time, velocity };
  };

  return {
    dispose: () => {
      voice?.source.stop();
      voice = null;
      output.disconnect();
    },
    load: (buffer) => {
      own = buffer;
    },
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      // Struck, a slice plays to its end; gated, it closes over the release.
      if (state.gate) {
        stop(voice, when(at), releaseSeconds(state.release));
      }
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      if (voice) {
        stop(voice, time, CHOKE * 4);
      }
      voice = play(note, id, time);
    },
    output,
    ready,
    update: (next) => {
      state = next;
      smooth(filter.frequency, cutoffHertz(next.cutoff));
      smooth(output.gain, volumeGain(next.volume) * MIX_GAIN);
      if (voice) {
        smooth(voice.source.playbackRate, rate(next.pitch));
      }
      if (next.sample !== wanted) {
        wanted = next.sample;
        own = null;
        fetch(next.sample);
      }
    },
  };
}
