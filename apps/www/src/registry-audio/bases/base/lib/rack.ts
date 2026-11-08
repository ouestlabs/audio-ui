/**
 * Racks: a device that holds chains of devices in parallel, sums them, and
 * turns parameters of the devices inside with eight macros. The rack's own
 * description is the `rack` of its track device; this lib reads it, plans it
 * and plays it.
 */
import type { DeviceContext, ParameterValue } from "@audio-ui/core/device";
import { panGains } from "@audio-ui/core/playback";
import type {
  Rack,
  RackChain,
  TrackDevice,
} from "@/registry-audio/bases/base/lib/arrangement";
import type {
  AnyDeviceState,
  LibraryDevice,
  LibraryEngine,
} from "@/registry-audio/bases/base/lib/device-library";

/** The longest a chain can wait for the others, in seconds. */
const MAX_WAIT_SECONDS = 2;

/** Finds a device of the library by the id a track device stores. */
export type FindDevice = (id: string) => LibraryDevice | undefined;

/** The chains a solo lets through: the soloed ones, or all of them while none is. */
export function heardChains(chains: readonly RackChain[]): Set<string> {
  const soloed = chains.filter((chain) => chain.mix?.soloed);
  return new Set(
    (soloed.length > 0 ? soloed : chains).map((chain) => chain.id)
  );
}

/** Where on its travel each mapped parameter sits, by device then parameter, from a rack's macros. */
export type MacroPositions = ReadonlyMap<string, ReadonlyMap<string, number>>;

/** The positions a rack's macros put their parameters at, over the ones a rack around it already set. */
export function macroPositions(
  rack: Rack,
  outer: MacroPositions = new Map()
): MacroPositions {
  const positions = new Map(
    [...outer].map(([device, parameters]) => [device, new Map(parameters)])
  );
  for (const macro of rack.macros) {
    const turn = Math.min(1, Math.max(0, macro.value));
    for (const { device, max, min, parameter } of macro.mappings) {
      const parameters = positions.get(device) ?? new Map<string, number>();
      parameters.set(parameter, min + turn * (max - min));
      positions.set(device, parameters);
    }
  }
  return positions;
}

/** A device's state as it plays: its own, with what the macros mapped to it set. */
export function playedState(
  device: TrackDevice,
  entry: LibraryDevice,
  positions: MacroPositions
): AnyDeviceState {
  const mapped = positions.get(device.id);
  if (!mapped) {
    return entry.device.sanitize(device.state) as AnyDeviceState;
  }
  const state: Record<string, ParameterValue> = { ...device.state };
  for (const [parameter, position] of mapped) {
    state[parameter] = entry.device.denormalize(parameter as never, position);
  }
  return entry.device.sanitize(state as never) as AnyDeviceState;
}

/** How long a device delays the sound as it plays, in seconds: a rack, as long as its slowest chain. */
export function deviceLatency(
  device: TrackDevice,
  find: FindDevice,
  sampleRate: number,
  positions: MacroPositions = new Map()
): number {
  if (device.rack) {
    return rackLatency(device.rack, find, sampleRate, positions);
  }
  const entry = find(device.device);
  return entry
    ? entry.device.latency(
        playedState(device, entry, positions) as never,
        sampleRate
      )
    : 0;
}

/** How long a rack delays the sound, in seconds: its slowest chain, each device on it in turn, switched on or off. */
export function rackLatency(
  rack: Rack,
  find: FindDevice,
  sampleRate: number,
  outer: MacroPositions = new Map()
): number {
  const positions = macroPositions(rack, outer);
  return Math.max(
    0,
    ...rack.chains.map((chain) =>
      chain.devices.reduce(
        (sum, device) =>
          sum + deviceLatency(device, find, sampleRate, positions),
        0
      )
    )
  );
}

/** A rack playing on a context: one link of a chain, its sound in at `input` and out at `output`. */
export interface RackEngine {
  /** Where the chain `id` takes its sound in: what a drum rack plays a pad into. */
  chainInput: (id: string) => AudioNode | undefined;
  dispose: () => void;
  readonly input: AudioNode;
  /** How long it delays the sound now, in seconds. */
  latency: () => number;
  readonly output: AudioNode;
  /** Resolves once every device inside is in the graph. */
  ready: () => Promise<void>;
  /** Brings the chains and their devices in step with `rack`, the macros a rack around it set over its own. */
  update: (rack: Rack, context?: DeviceContext, outer?: MacroPositions) => void;
}

/** A device placed on a chain of a rack. */
interface Placed {
  bypass: DelayNode;
  device: TrackDevice;
  /** What it plays as: an engine of the library, or a rack within the rack. */
  link: { engine: LibraryEngine; entry: LibraryDevice } | { rack: RackEngine };
}

interface PlayedChain {
  input: GainNode;
  key: string;
  left: GainNode;
  merger: ChannelMergerNode;
  placed: Map<string, Placed>;
  right: GainNode;
  splitter: ChannelSplitterNode;
  volume: GainNode;
  wait: DelayNode;
}

const nodesOf = (link: Placed["link"]) =>
  "rack" in link
    ? link.rack
    : (link.engine as { input: AudioNode; output: AudioNode });

/**
 * Plays racks on `ctx`: each chain takes the rack's input, its devices in
 * series (one switched off passes the sound on, as late as it would make
 * it), then waits for the slowest chain so all of them meet on the same
 * frame, then its volume, pan and switch, summed at the output. A solo lets
 * only the soloed chains through. Devices are made with `find`; a rack
 * inside a rack plays the same way. With `fed: false` the chains do not take
 * the rack's input: each is played into at its own (`chainInput`), as a drum
 * rack's pads are.
 */
export function createRackEngine(
  ctx: BaseAudioContext,
  find: FindDevice,
  { fed = true }: { fed?: boolean } = {}
): RackEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const chains = new Map<string, PlayedChain>();
  let current: Rack = { chains: [], macros: [] };
  let positions: MacroPositions = new Map();
  let around: MacroPositions = new Map();

  const makeChain = (): PlayedChain => {
    const made: PlayedChain = {
      input: ctx.createGain(),
      key: "",
      left: ctx.createGain(),
      merger: ctx.createChannelMerger(2),
      placed: new Map(),
      right: ctx.createGain(),
      splitter: ctx.createChannelSplitter(2),
      volume: ctx.createGain(),
      wait: ctx.createDelay(MAX_WAIT_SECONDS),
    };
    if (fed) {
      input.connect(made.input);
    }
    // Stereo before the pan: a mono sound, such as a Drum Synth's, goes to both sides, not to the left alone.
    made.volume.channelCount = 2;
    made.volume.channelCountMode = "explicit";
    made.wait.connect(made.volume).connect(made.splitter);
    made.splitter.connect(made.left, 0).connect(made.merger, 0, 0);
    made.splitter.connect(made.right, 1).connect(made.merger, 0, 1);
    made.merger.connect(output);
    made.input.connect(made.wait);
    return made;
  };

  const disposePlaced = (placed: Placed) => {
    if ("rack" in placed.link) {
      placed.link.rack.dispose();
    } else {
      placed.link.engine.dispose();
    }
    placed.bypass.disconnect();
  };

  const disposeChain = (chain: PlayedChain) => {
    for (const placed of chain.placed.values()) {
      disposePlaced(placed);
    }
    for (const node of [
      chain.input,
      chain.wait,
      chain.volume,
      chain.splitter,
      chain.left,
      chain.right,
      chain.merger,
    ]) {
      node.disconnect();
    }
  };

  /** A device of a chain made, or brought in step, as it plays under the macros. */
  const place = (
    chain: PlayedChain,
    device: TrackDevice,
    context: DeviceContext | undefined
  ) => {
    const before = chain.placed.get(device.id);
    if (device.rack) {
      const rack =
        before && "rack" in before.link
          ? before.link.rack
          : createRackEngine(ctx, find);
      if (before && !("rack" in before.link)) {
        disposePlaced(before);
      }
      rack.update(device.rack, context, positions);
      const bypass = before?.bypass ?? ctx.createDelay(MAX_WAIT_SECONDS);
      chain.placed.set(device.id, { bypass, device, link: { rack } });
      return;
    }
    const entry = find(device.device);
    if (entry?.device.kind !== "effect") {
      return;
    }
    const values = playedState(device, entry, positions);
    if (before && "engine" in before.link && before.link.entry === entry) {
      before.link.engine.update(values, context);
      chain.placed.set(device.id, { ...before, device });
      return;
    }
    if (before) {
      disposePlaced(before);
    }
    chain.placed.set(device.id, {
      bypass: ctx.createDelay(MAX_WAIT_SECONDS),
      device,
      link: { engine: entry.create(ctx, values, context), entry },
    });
  };

  /** A chain's devices wired in series again, only when they or their switches changed. */
  const rewire = (chain: PlayedChain, devices: readonly TrackDevice[]) => {
    const key = devices
      .map((device) => `${device.id}:${device.on === false ? "off" : "on"}`)
      .join(",");
    if (key === chain.key) {
      return;
    }
    chain.key = key;
    chain.input.disconnect();
    for (const placed of chain.placed.values()) {
      nodesOf(placed.link).output.disconnect();
      placed.bypass.disconnect();
    }
    let from: AudioNode = chain.input;
    for (const device of devices) {
      const placed = chain.placed.get(device.id);
      if (placed) {
        const nodes =
          device.on === false
            ? { input: placed.bypass, output: placed.bypass }
            : nodesOf(placed.link);
        from.connect(nodes.input);
        from = nodes.output;
      }
    }
    from.connect(chain.wait);
  };

  const latencyOf = (devices: readonly TrackDevice[]) =>
    devices.reduce(
      (sum, device) =>
        sum + deviceLatency(device, find, ctx.sampleRate, positions),
      0
    );

  /** A chain of the rack in step: its devices made and wired, its wait, volume and pan. */
  const syncChain = (
    description: RackChain,
    context: DeviceContext | undefined,
    slowest: number,
    heard: ReadonlySet<string>
  ) => {
    const chain = chains.get(description.id) ?? makeChain();
    chains.set(description.id, chain);
    const devices = description.devices.filter(
      (device) => device.rack || find(device.device)?.device.kind === "effect"
    );
    for (const [id, placed] of chain.placed) {
      if (!devices.some((device) => device.id === id)) {
        disposePlaced(placed);
        chain.placed.delete(id);
      }
    }
    for (const device of devices) {
      place(chain, device, context);
      const placed = chain.placed.get(device.id);
      if (placed) {
        placed.bypass.delayTime.value = deviceLatency(
          device,
          find,
          ctx.sampleRate,
          positions
        );
      }
    }
    rewire(chain, devices);
    chain.wait.delayTime.value = Math.min(
      MAX_WAIT_SECONDS,
      slowest - latencyOf(devices)
    );
    const mix = description.mix ?? {
      gain: 1,
      muted: false,
      pan: 0,
      soloed: false,
    };
    const [left, right] = panGains(mix.pan);
    chain.volume.gain.value =
      mix.muted || !heard.has(description.id) ? 0 : Math.max(0, mix.gain);
    chain.left.gain.value = left;
    chain.right.gain.value = right;
  };

  const update: RackEngine["update"] = (rack, context, outer) => {
    current = rack;
    around = outer ?? new Map();
    positions = macroPositions(rack, around);
    const kept = new Set(rack.chains.map((chain) => chain.id));
    for (const [id, chain] of chains) {
      if (!kept.has(id)) {
        disposeChain(chain);
        chains.delete(id);
      }
    }
    const heard = heardChains(rack.chains);
    const slowest = rackLatency(rack, find, ctx.sampleRate, outer);
    for (const description of rack.chains) {
      syncChain(description, context, slowest, heard);
    }
  };

  return {
    chainInput: (id) => chains.get(id)?.input,
    dispose: () => {
      for (const chain of chains.values()) {
        disposeChain(chain);
      }
      chains.clear();
      input.disconnect();
      output.disconnect();
    },
    input,
    latency: () => rackLatency(current, find, ctx.sampleRate, around),
    output,
    ready: async () => {
      await Promise.all(
        [...chains.values()].flatMap((chain) =>
          [...chain.placed.values()].map((placed) =>
            "rack" in placed.link
              ? placed.link.rack.ready()
              : placed.link.engine.ready
          )
        )
      );
    },
    update,
  };
}
