import type { DeviceContext } from "@audio-ui/core/device";
import type {
  DrumSound,
  Rack,
  RackChain,
} from "@/lib/arrangement";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/lib/drum-synthesis";
import {
  createRackEngine,
  type FindDevice,
} from "@/lib/rack";

/** A recording a pad plays: an `AudioBuffer`, or its channels decoded. */
export type PadRecording =
  | AudioBuffer
  | { channels: readonly Float32Array[]; sampleRate: number };

/** The level a recording fades from at the end of its decay, so it stops without a click. */
const FADE_SECONDS = 0.005;

const VOICES = { hat: triggerHihat, kick: triggerKick, snare: triggerSnare };

/** The pads of a drum rack that a note plays: the chains that answer it. */
export function padsOf(rack: Rack, note: number): RackChain[] {
  return rack.chains.filter((chain) => chain.pad?.note === note);
}

/** A drum rack playing on a context: an instrument, its sound out at `output`. */
export interface DrumRackEngine {
  /** Takes back the hits that start after `time` on the audio clock, as a stop does; those sounding ring out. */
  cancel: (time: number) => void;
  dispose: () => void;
  /** Plays the pads of `note` at `time` on the audio clock, as loud as `velocity`, 0 to 1. */
  hit: (note: number, velocity: number, time: number) => void;
  /** How long it delays the sound, in seconds: its slowest chain. */
  latency: () => number;
  readonly output: AudioNode;
  /** Resolves once every device inside is in the graph. */
  ready: () => Promise<void>;
  /** Brings the pads, their chains and the macros in step with `rack`, the recordings the pads name in `recordings`. */
  update: (
    rack: Rack,
    context?: DeviceContext,
    recordings?: ReadonlyMap<string, PadRecording>
  ) => void;
}

/**
 * Plays drum racks on `ctx`. A hit plays each pad of its note once through a
 * gain as loud as its velocity, into the pad's chain; it rings for its decay
 * whatever the note's length, as a drum does. Devices are made with `find`.
 */
export function createDrumRackEngine(
  ctx: BaseAudioContext,
  find: FindDevice
): DrumRackEngine {
  const rack = createRackEngine(ctx, find, { fed: false });
  let current: Rack = { chains: [], macros: [] };
  let recordings: ReadonlyMap<string, PadRecording> = new Map();
  const buffers = new WeakMap<object, AudioBuffer>();
  let pending: { gain: GainNode; time: number }[] = [];

  const bufferOf = (id: string): AudioBuffer | undefined => {
    const source = recordings.get(id);
    if (!source) {
      return;
    }
    if ("getChannelData" in source) {
      return source;
    }
    const made = buffers.get(source);
    if (made) {
      return made;
    }
    const channels = source.channels.slice(0, 2);
    const buffer = ctx.createBuffer(
      Math.max(1, channels.length),
      channels[0]?.length || 1,
      source.sampleRate
    );
    for (const [index, channel] of channels.entries()) {
      buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, index);
    }
    buffers.set(source, buffer);
    return buffer;
  };

  const play = (sound: DrumSound, into: AudioNode, time: number) => {
    if (sound.kind === "synth") {
      VOICES[sound.voice](ctx, into, time, {
        decay: sound.decay,
        tune: sound.tune,
      });
      return;
    }
    const buffer = bufferOf(sound.recording);
    if (!buffer) {
      return;
    }
    const source = ctx.createBufferSource();
    const fade = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** (sound.tune / 12);
    const end = time + sound.decay;
    fade.gain.setValueAtTime(1, Math.max(time, end - FADE_SECONDS));
    fade.gain.linearRampToValueAtTime(0, end);
    source.connect(fade).connect(into);
    source.start(time);
    source.stop(end);
  };

  return {
    cancel: (time) => {
      for (const hit of pending) {
        if (hit.time > time) {
          hit.gain.disconnect();
        }
      }
      pending = [];
    },
    dispose: () => {
      for (const hit of pending) {
        hit.gain.disconnect();
      }
      pending = [];
      rack.dispose();
    },
    hit: (note, velocity, time) => {
      if (velocity <= 0) {
        return;
      }
      pending = pending.filter((hit) => hit.time > ctx.currentTime);
      for (const chain of padsOf(current, note)) {
        const input = rack.chainInput(chain.id);
        if (input && chain.pad) {
          const gain = ctx.createGain();
          gain.gain.value = Math.min(1, velocity);
          gain.connect(input);
          play(chain.pad.sound, gain, time);
          pending.push({ gain, time });
        }
      }
    },
    latency: rack.latency,
    output: rack.output,
    ready: rack.ready,
    update: (next, context, sources) => {
      current = next;
      if (sources) {
        recordings = sources;
      }
      rack.update(next, context);
    },
  };
}