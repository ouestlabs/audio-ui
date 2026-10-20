/**
 * The sound of Altair-16: a sampler that cuts one sample into sixteen equal
 * slices and plays a slice per pad. A hit starts a buffer source at the
 * slice's start, for its length, through a low-pass filter, with an envelope
 * that opens in a few milliseconds and closes in the release time.
 *
 * The controls speak in the panel's own units; each one is mapped here to the
 * unit the node takes. Everything that moves does so with ramps, and the
 * engine plays into the bus it is attached to, which owns the master level
 * and the safety limiter.
 */

export const SLICES = 16;

export type Param = "cutoff" | "pitch" | "release";
export interface Settings {
  cutoff: number;
  /** Pad held: a slice plays while it is held. Pad struck: it plays to its end. */
  gate: boolean;
  /** One slice at a time: a hit stops the others. */
  mono: boolean;
  pitch: number;
  release: number;
}

export const DEFAULTS: Settings = {
  cutoff: 10,
  gate: false,
  mono: true,
  pitch: 0,
  release: 3,
};

const ATTACK = 0.003;
const MIN_CUTOFF = 200;
const MAX_CUTOFF = 18_000;
/** How fast a stopped voice goes, as a time constant, when another one takes its place. */
const CHOKE = 0.008;
/** Headroom: a few slices at once still leave the bus's limiter room. */
const MIX_GAIN = 0.7;

const cutoffHertz = (value: number) =>
  MIN_CUTOFF * (MAX_CUTOFF / MIN_CUTOFF) ** (value / 10);
const releaseSeconds = (value: number) => 0.01 * 150 ** (value / 10);
const rate = (semitones: number) => 2 ** (semitones / 12);

interface Voice {
  env: GainNode;
  length: number;
  offset: number;
  slice: number;
  source: AudioBufferSourceNode;
  startedAt: number;
}

export function createAltairEngine() {
  const settings: Settings = { ...DEFAULTS };
  let buffer: AudioBuffer | null = null;
  let graph: { ctx: BaseAudioContext; filter: BiquadFilterNode } | null = null;
  const voices = new Set<Voice>();

  const sliceLength = () => (buffer ? buffer.duration / SLICES : 0);

  /** Lets a voice go: its envelope closes over `seconds`, then it is torn down. */
  function stop(voice: Voice, seconds: number) {
    if (!graph) {
      return;
    }
    const now = graph.ctx.currentTime;
    voice.env.gain.cancelScheduledValues(now);
    voice.env.gain.setValueAtTime(voice.env.gain.value, now);
    voice.env.gain.setTargetAtTime(0, now, seconds / 4);
    voice.source.stop(now + seconds + 0.05);
    voices.delete(voice);
  }

  return {
    /** Builds the filter into `destination` (the bus): nothing sounds until a hit. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoffHertz(settings.cutoff);
      filter.Q.value = 0.7;
      const mix = ctx.createGain();
      mix.gain.value = MIX_GAIN;
      filter.connect(mix).connect(destination);
      graph = { ctx, filter };
    },
    /** Stops every voice and disconnects what this engine made; the shared context stays. */
    detach() {
      for (const voice of voices) {
        voice.source.stop();
      }
      voices.clear();
      graph?.filter.disconnect();
      graph = null;
    },
    load(next: AudioBuffer | null) {
      for (const voice of [...voices]) {
        stop(voice, 0.02);
      }
      buffer = next;
    },
    /** Where the newest voice is in the sample, in seconds, or `null` once it has ended. */
    position() {
      if (!graph) {
        return null;
      }
      let newest: Voice | null = null;
      for (const voice of voices) {
        if (!newest || voice.startedAt > newest.startedAt) {
          newest = voice;
        }
      }
      if (!newest) {
        return null;
      }
      const played =
        (graph.ctx.currentTime - newest.startedAt) * rate(settings.pitch);
      return played < newest.length ? newest.offset + played : null;
    },
    /** A pad let go: in gate mode, its slice's envelope closes. */
    release(slice: number) {
      if (!settings.gate) {
        return;
      }
      for (const voice of [...voices]) {
        if (voice.slice === slice) {
          stop(voice, releaseSeconds(settings.release));
        }
      }
    },
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      const now = graph.ctx.currentTime;
      if (key === "cutoff") {
        graph.filter.frequency.setTargetAtTime(
          cutoffHertz(value as number),
          now,
          0.02
        );
      }
      if (key === "pitch") {
        for (const voice of voices) {
          voice.source.playbackRate.setTargetAtTime(
            rate(value as number),
            now,
            0.02
          );
        }
      }
    },
    /** Plays a slice now; `velocity` is from 0 to 1. */
    strike(slice: number, velocity = 1) {
      if (!(graph && buffer)) {
        return;
      }
      const { ctx, filter } = graph;
      const length = sliceLength();
      if (settings.mono) {
        for (const voice of [...voices]) {
          stop(voice, CHOKE * 4);
        }
      }
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate(settings.pitch);
      // A tail fade, so a slice ends without a click: it is separate from the
      // envelope a released pad closes.
      const tail = ctx.createGain();
      const play = length / rate(settings.pitch);
      const fade = Math.min(releaseSeconds(settings.release), play / 2);
      tail.gain.setValueAtTime(1, now);
      tail.gain.setValueAtTime(1, now + play - fade);
      tail.gain.linearRampToValueAtTime(0, now + play);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(velocity, now + ATTACK);
      source.connect(tail).connect(env).connect(filter);
      const voice: Voice = {
        env,
        length,
        offset: slice * length,
        slice,
        source,
        startedAt: now,
      };
      source.start(now, slice * length, length);
      source.onended = () => {
        voices.delete(voice);
        source.disconnect();
        tail.disconnect();
        env.disconnect();
      };
      voices.add(voice);
    },
  };
}

export type AltairEngine = ReturnType<typeof createAltairEngine>;
