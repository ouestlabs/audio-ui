import type { DeviceContext } from "@audio-ui/engine/device";
import type {
  DrumSound,
  Rack,
  RackChain,
  TrackDevice,
} from "@/lib/arrangement";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/lib/drum-synthesis";
import { chainInstrument } from "@/lib/instrument-rack";
import {
  createRackEngine,
  type FindDevice,
  type MacroPositions,
  macroPositions,
  playedState,
} from "@/lib/rack";
import {
  createVoicePool,
  type NotePlayer,
  type VoicePool,
} from "@/lib/voice-pool";

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

/**
 * A drum rack playing on a context: a note player whose note on plays the
 * pads of its pitch, as loud as its velocity, and rings for their decay; a
 * note off lets nothing go, and `release` takes back the hits that start after
 * its time, as a stop does, those sounding ringing out. Its sound comes out at
 * `output`.
 */
export interface DrumRackEngine extends NotePlayer {
  /** How long it delays the sound, in seconds: its slowest chain. */
  latency: () => number;
  readonly output: AudioNode;
  /** Brings the pads, their chains and the macros in step with `rack`, the recordings the pads name in `recordings`. */
  update: (
    rack: Rack,
    context?: DeviceContext,
    recordings?: ReadonlyMap<string, PadRecording>,
    outer?: MacroPositions
  ) => void;
}

/** How fast a choked pad falls silent, as a time constant in seconds. */
const CHOKE_SECONDS = 0.01;
/** The pitch a pad's instrument is played at, whatever note the pad answers: middle C, so a melodic instrument on a pad plays in its own key. */
const PAD_PITCH = 60;
/** How many voices a pad's instrument has, when it is not one engine for every note. */
const PAD_VOICES = 4;

/** A pad's instrument: the device it is, played by a pool of voices into the pad. */
interface PadPlayer {
  device: TrackDevice;
  pool: VoicePool;
}

/**
 * Plays drum racks on `ctx`. A hit plays each pad of its note once: the
 * instrument at the head of the pad's chain, given the note's velocity and
 * let go with its note off, or else the pad's sound, through a gain as loud as
 * the velocity, ringing for its decay whatever the note's length. Every pad
 * sounds through a gain of its own, which a hit on another pad of its choke
 * group closes. Devices are made with `find`.
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
  /** Each pad's own gain, between what it plays and its chain: what a choke closes. */
  const padGains = new Map<string, GainNode>();
  const players = new Map<string, PadPlayer>();

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

  /** The pad's own gain into its chain, made the first time it is needed. */
  const padGainOf = (chain: string): GainNode | undefined => {
    const kept = padGains.get(chain);
    if (kept) {
      return kept;
    }
    const input = rack.chainInput(chain);
    if (!input) {
      return;
    }
    const gain = ctx.createGain();
    gain.connect(input);
    padGains.set(chain, gain);
    return gain;
  };

  const dropPad = (chain: string) => {
    players.get(chain)?.pool.dispose();
    players.delete(chain);
    padGains.get(chain)?.disconnect();
    padGains.delete(chain);
  };

  /** Brings the instrument at the head of a pad's chain in step: made, updated, or let go when the pad has none. */
  const syncPlayer = (
    chain: RackChain,
    positions: ReturnType<typeof macroPositions>,
    context: DeviceContext | undefined
  ) => {
    const played = chain.pad ? chainInstrument(chain.devices, find) : undefined;
    const player = players.get(chain.id);
    if (!played) {
      player?.pool.dispose();
      players.delete(chain.id);
      return;
    }
    const values = playedState(played.device, played.entry, positions);
    if (
      player?.device.id === played.device.id &&
      player.pool.entry === played.entry
    ) {
      player.pool.update(values, context);
      player.device = played.device;
      return;
    }
    const into = padGainOf(chain.id);
    if (!into) {
      return;
    }
    player?.pool.dispose();
    players.set(chain.id, {
      device: played.device,
      pool: createVoicePool(
        ctx,
        played.entry,
        values,
        context,
        PAD_VOICES,
        into
      ),
    });
  };

  const cancel = (time: number) => {
    for (const hit of pending) {
      if (hit.time > time) {
        hit.gain.disconnect();
      }
    }
    pending = [];
    for (const player of players.values()) {
      player.pool.release(time);
    }
    // A choke still ahead does not cut what plays after the stop.
    for (const gain of padGains.values()) {
      gain.gain.cancelScheduledValues(time);
    }
  };

  /** Cuts short the other pads of `chain`'s choke group at `time`. */
  const choke = (chain: RackChain, time: number) => {
    const group = chain.pad?.choke;
    if (group === undefined) {
      return;
    }
    for (const other of current.chains) {
      if (other.id !== chain.id && other.pad?.choke === group) {
        padGains.get(other.id)?.gain.setTargetAtTime(0, time, CHOKE_SECONDS);
      }
    }
  };

  const hit = (note: number, velocity: number, time: number, id: string) => {
    if (velocity <= 0) {
      return;
    }
    pending = pending.filter((item) => item.time > ctx.currentTime);
    for (const chain of padsOf(current, note)) {
      const into = padGainOf(chain.id);
      if (!(into && chain.pad)) {
        continue;
      }
      choke(chain, time);
      into.gain.setValueAtTime(1, time);
      const player = players.get(chain.id);
      if (player) {
        player.pool.noteOn(
          { pitch: PAD_PITCH, velocity },
          time,
          `${id}:${chain.id}`
        );
      } else if (chain.pad.sound) {
        const gain = ctx.createGain();
        gain.gain.value = Math.min(1, velocity);
        gain.connect(into);
        play(chain.pad.sound, gain, time);
        pending.push({ gain, time });
      }
    }
  };

  return {
    dispose: () => {
      for (const item of pending) {
        item.gain.disconnect();
      }
      pending = [];
      for (const chain of [...padGains.keys(), ...players.keys()]) {
        dropPad(chain);
      }
      rack.dispose();
    },
    latency: rack.latency,
    // A pad's instrument is let go; a pad's own sound rings for its decay, whatever the note's length.
    noteOff: (time, id) => {
      for (const [chain, player] of players) {
        player.pool.noteOff(time, `${id}:${chain}`);
      }
    },
    noteOn: (note, time, id) => hit(note.pitch, note.velocity, time, id),
    output: rack.output,
    ready: async () => {
      await Promise.all([
        rack.ready(),
        ...[...players.values()].map((player) => player.pool.ready()),
      ]);
    },
    release: cancel,
    update: (next, context, sources, outer) => {
      current = next;
      if (sources) {
        recordings = sources;
      }
      rack.update(next, context, outer);
      const positions = macroPositions(next, outer);
      const kept = new Set(next.chains.map((chain) => chain.id));
      for (const chain of [...padGains.keys(), ...players.keys()]) {
        if (!kept.has(chain)) {
          dropPad(chain);
        }
      }
      for (const chain of next.chains) {
        syncPlayer(chain, positions, context);
      }
    },
  };
}