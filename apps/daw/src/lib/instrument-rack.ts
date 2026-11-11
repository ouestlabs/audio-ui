import type { DeviceContext } from "@audio-ui/engine/device";
import {
  type ChainZone,
  inZone,
  type Rack,
  type TrackDevice,
} from "@/lib/arrangement";
import type { LibraryDevice } from "@/lib/device-library";
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

/** The instrument a chain of an instrument rack plays: its first device, when it is an instrument of the library. */
export function chainInstrument(
  devices: readonly TrackDevice[],
  find: FindDevice
): { device: TrackDevice; entry: LibraryDevice } | undefined {
  const [first] = devices;
  const entry = first?.instrument ? find(first.device) : undefined;
  return first && entry?.device.kind === "instrument"
    ? { device: first, entry }
    : undefined;
}

/** An instrument rack playing on a context: a note player, its sound out at `output`. */
export interface InstrumentRackEngine extends NotePlayer {
  /** How long it delays the sound, in seconds: its slowest chain. */
  latency: () => number;
  readonly output: AudioNode;
  /** Brings the chains, their instruments and effects, and the macros in step with `rack`, the macros a rack around it set over its own. */
  update: (rack: Rack, context?: DeviceContext, outer?: MacroPositions) => void;
}

interface Layer {
  device: TrackDevice;
  pool: VoicePool;
  zone: ChainZone | undefined;
}

/**
 * Plays instrument racks on `ctx`: each chain's instrument with `voices`
 * voices into the chain, its effects in series after it, the chains summed as
 * any rack's. A note goes to every chain that has an instrument; a chain
 * switched off or soloed away is silent, as a rack's chain is. Devices are
 * made with `find`.
 */
export function createInstrumentRackEngine(
  ctx: BaseAudioContext,
  find: FindDevice,
  voices: number
): InstrumentRackEngine {
  const rack = createRackEngine(ctx, find, { fed: false });
  const layers = new Map<string, Layer>();

  const dropLayer = (chain: string) => {
    layers.get(chain)?.pool.dispose();
    layers.delete(chain);
  };

  return {
    dispose: () => {
      for (const chain of [...layers.keys()]) {
        dropLayer(chain);
      }
      rack.dispose();
    },
    latency: rack.latency,
    noteOff: (time, id) => {
      for (const layer of layers.values()) {
        layer.pool.noteOff(time, id);
      }
    },
    // A note plays the chains whose zone holds it; a note off goes to them all, and lets go where the note is held.
    noteOn: (note, time, id) => {
      for (const layer of layers.values()) {
        if (inZone(layer.zone, note.pitch, note.velocity)) {
          layer.pool.noteOn(note, time, id);
        }
      }
    },
    output: rack.output,
    ready: async () => {
      await Promise.all([
        rack.ready(),
        ...[...layers.values()].map((layer) => layer.pool.ready()),
      ]);
    },
    release: (time) => {
      for (const layer of layers.values()) {
        layer.pool.release(time);
      }
    },
    update: (next, context, outer) => {
      rack.update(next, context, outer);
      const positions = macroPositions(next, outer);
      const kept = new Set(next.chains.map((chain) => chain.id));
      for (const chain of [...layers.keys()]) {
        if (!kept.has(chain)) {
          dropLayer(chain);
        }
      }
      for (const chain of next.chains) {
        const played = chainInstrument(chain.devices, find);
        const layer = layers.get(chain.id);
        if (!played) {
          dropLayer(chain.id);
          continue;
        }
        const values = playedState(played.device, played.entry, positions);
        if (
          layer?.device.id === played.device.id &&
          layer.pool.entry === played.entry
        ) {
          layer.pool.update(values, context);
          layer.device = played.device;
          layer.zone = chain.zone;
          continue;
        }
        const input = rack.chainInput(chain.id);
        if (!input) {
          continue;
        }
        layer?.pool.dispose();
        layers.set(chain.id, {
          device: played.device,
          pool: createVoicePool(
            ctx,
            played.entry,
            values,
            context,
            voices,
            input
          ),
          zone: chain.zone,
        });
      }
    },
  };
}