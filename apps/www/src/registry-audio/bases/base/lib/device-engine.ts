import { pink, white } from "@audio/synth-noise";
import type {
  DeviceBinding,
  DeviceContext,
  InstrumentBinding,
} from "@audio-ui/engine/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";

/**
 * The engine of an effect on the Web Audio API: the binding of its state
 * (`update`, `dispose`, `readings`) between an input and an output. Every
 * `create<Name>Engine` of an effect returns one, with what it adds of its own.
 */
export interface EffectEngine<State> extends DeviceBinding<State> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the worklet it runs is in the graph, `false` where it cannot run. Until then it plays without it. */
  readonly ready?: Promise<boolean>;
  /** The input of the signal that drives it, on a device a sidechain keys. Only listened to, never heard. */
  readonly sidechain?: AudioNode;
}

/**
 * The engine of an instrument: one voice, notes in, sound out. `noteOn`
 * starts a note or moves the held one to it, `noteOff` lets it go; a host
 * plays chords with one engine per note (`createPolyphony`).
 */
export interface InstrumentEngine<State, Note>
  extends InstrumentBinding<State, Note> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once what it loads is in the graph. */
  readonly ready?: Promise<boolean>;
}

/** What every `create<Name>Engine` is: an engine on a context, for the state it starts with and the host's tempo. */
export type EngineFactory<State, Engine> = (
  ctx: BaseAudioContext,
  state: State,
  context?: DeviceContext
) => Engine;

/** A worklet that takes over from the clean sound once it is in the graph. */
export interface WorkletStage {
  /** Sends both paths, the clean sound and the worklet's, on to `destination`. */
  connect: (destination: AudioNode) => void;
  dispose: () => void;
  /** The worklet, once it is in the graph: `null` until then, and for good where it cannot run. */
  readonly node: AudioWorkletNode | null;
  /** Resolves to `true` once the worklet plays, `false` where it cannot. */
  readonly ready: Promise<boolean>;
}

/**
 * A stage of an engine that runs a worklet: the sound passes clean while the
 * worklet loads, then fades over to it.
 *
 * ```
 * input → clean ─────────────────────┐
 *       → worklet (once loaded) → processed ─┴→ connect(destination)
 * ```
 *
 * `make` builds the worklet once its source is loaded, from the state the
 * engine holds then, unless the engine was disposed first. The fade is a
 * `setTargetAtTime` at `ramp` seconds. Two gains are made, the processed path
 * then the clean one.
 */
export function createWorkletStage(
  ctx: BaseAudioContext,
  {
    input,
    make,
    ramp,
    source,
  }: {
    /** What feeds both paths: the engine's input. */
    input: AudioNode;
    /** Makes the worklet, once loaded. */
    make: () => AudioWorkletNode;
    /** The time constant of the fade, in seconds. */
    ramp: number;
    /** The source of the worklet's processor, as `loadWorklet` takes it. */
    source: string;
  }
): WorkletStage {
  const processed = ctx.createGain();
  const clean = ctx.createGain();
  processed.gain.value = 0;
  clean.gain.value = 1;
  input.connect(clean);
  let node: AudioWorkletNode | null = null;
  let disposed = false;

  const ready = loadWorklet(ctx, source).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    node = make();
    input.connect(node).connect(processed);
    processed.gain.setTargetAtTime(1, ctx.currentTime, ramp);
    clean.gain.setTargetAtTime(0, ctx.currentTime, ramp);
    return true;
  });

  return {
    connect: (destination) => {
      clean.connect(destination);
      processed.connect(destination);
    },
    dispose: () => {
      disposed = true;
      clean.disconnect();
      processed.disconnect();
      node?.disconnect();
    },
    get node() {
      return node;
    },
    ready,
  };
}

/** How long after a path stops a worklet is still fed, in ms: its fade is over by then. */
export const FEED_RELEASE_MS = 120;

/** A connection a feed makes: `from` into `to`, at an output and an input of their own if given. */
export type FeedConnection = readonly [
  from: AudioNode,
  to: AudioNode,
  output?: number,
  input?: number,
];

/** Connections made while a path plays and taken away once it has faded out. */
export interface Feed {
  /** Clears what is still to be taken away. */
  dispose: () => void;
  /** Makes the connections at once when `on`; when off, takes them away `releaseMs` later, unless they are wanted again before. */
  set: (on: boolean) => void;
}

/**
 * Feeds a worklet only while the path it plays is heard: a worklet fed
 * nothing costs nothing. The connections are made on `set(true)` and taken
 * away `releaseMs` after `set(false)`, once the path has faded out, so
 * nothing is cut short.
 */
export function createFeed(
  connections: readonly FeedConnection[],
  releaseMs = FEED_RELEASE_MS
): Feed {
  let fed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    dispose: () => clearTimeout(timer),
    set: (on) => {
      clearTimeout(timer);
      if (on && !fed) {
        for (const [from, to, output, input] of connections) {
          from.connect(to, output, input);
        }
        fed = true;
      } else if (!on && fed) {
        timer = setTimeout(() => {
          if (fed) {
            for (const [from, to] of connections) {
              from.disconnect(to);
            }
            fed = false;
          }
        }, releaseMs);
      }
    },
  };
}

/** How long a noise buffer lasts, in seconds: long enough that its loop is never heard. */
const NOISE_SECONDS = 2;
const noises = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>();

/** The colors of noise a buffer is made in, as `@audio/synth-noise` makes them. */
export type NoiseColor = "pink" | "white";

/**
 * Two seconds of noise on a context, from `@audio/synth-noise` (seeded, its
 * peak at 0.9), made once per color and context and shared by everything that
 * plays it: a synth's noise source, a snare's rattle, the pink noise an
 * equalizer is heard through. A buffer is only read, so any number of sources
 * loop the same one.
 */
export function noiseBuffer(
  ctx: BaseAudioContext,
  color: NoiseColor = "white"
): AudioBuffer {
  const kept = noises.get(ctx) ?? new Map<NoiseColor, AudioBuffer>();
  noises.set(ctx, kept);
  const cached = kept.get(color);
  if (cached) {
    return cached;
  }
  const samples = (color === "pink" ? pink : white)(NOISE_SECONDS, {
    fs: ctx.sampleRate,
  });
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  kept.set(color, buffer);
  return buffer;
}
