"use client";

import type {
  Device,
  DeviceContext,
  DeviceState,
  ParameterDescriptor,
  ParameterValue,
} from "@audio-ui/core/device";
import type { Tempo } from "@audio-ui/core/time";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeviceBrowser } from "@/registry-audio/bases/base/audio/elements/device-browser";
import {
  DeviceChain,
  DeviceChainAdd,
  DeviceChainSlot,
  DeviceChainSlotControls,
} from "@/registry-audio/bases/base/audio/elements/device-chain";
import { ChorusPanel } from "@/registry-audio/bases/base/audio/panels/chorus-panel";
import { CompressorPanel } from "@/registry-audio/bases/base/audio/panels/compressor-panel";
import { DelayPanel } from "@/registry-audio/bases/base/audio/panels/delay-panel";
import { EqualizerPanel } from "@/registry-audio/bases/base/audio/panels/equalizer-panel";
import { FilterPanel } from "@/registry-audio/bases/base/audio/panels/filter-panel";
import { LimiterPanel } from "@/registry-audio/bases/base/audio/panels/limiter-panel";
import { ReduxPanel } from "@/registry-audio/bases/base/audio/panels/redux-panel";
import { ReverbPanel } from "@/registry-audio/bases/base/audio/panels/reverb-panel";
import { SaturatorPanel } from "@/registry-audio/bases/base/audio/panels/saturator-panel";
import { UtilityPanel } from "@/registry-audio/bases/base/audio/panels/utility-panel";
import {
  type DemoEngine,
  useDeviceLoop,
} from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { chorusDevice } from "@/registry-audio/bases/base/lib/chorus-device";
import { createChorusEngine } from "@/registry-audio/bases/base/lib/chorus-engine";
import { compressorDevice } from "@/registry-audio/bases/base/lib/compressor-device";
import { createCompressorEngine } from "@/registry-audio/bases/base/lib/compressor-engine";
import { delayDevice } from "@/registry-audio/bases/base/lib/delay-device";
import { createDelayEngine } from "@/registry-audio/bases/base/lib/delay-engine";
import { equalizerDevice } from "@/registry-audio/bases/base/lib/equalizer-device";
import { createEqualizerEngine } from "@/registry-audio/bases/base/lib/equalizer-engine";
import { filterDevice } from "@/registry-audio/bases/base/lib/filter-device";
import { createFilterEngine } from "@/registry-audio/bases/base/lib/filter-engine";
import { limiterDevice } from "@/registry-audio/bases/base/lib/limiter-device";
import { createLimiterEngine } from "@/registry-audio/bases/base/lib/limiter-engine";
import { reduxDevice } from "@/registry-audio/bases/base/lib/redux-device";
import { createReduxEngine } from "@/registry-audio/bases/base/lib/redux-engine";
import { reverbDevice } from "@/registry-audio/bases/base/lib/reverb-device";
import { createReverbEngine } from "@/registry-audio/bases/base/lib/reverb-engine";
import { saturatorDevice } from "@/registry-audio/bases/base/lib/saturator-device";
import { createSaturatorEngine } from "@/registry-audio/bases/base/lib/saturator-engine";
import { utilityDevice } from "@/registry-audio/bases/base/lib/utility-device";
import { createUtilityEngine } from "@/registry-audio/bases/base/lib/utility-engine";

const MASTER_VOLUME = 0.7;

type AnyState = Record<string, ParameterValue>;

/** What the chain gives a device's panel: the props every panel of the catalog takes. */
interface ChainPanelProps<State> {
  children?: ReactNode;
  className?: string;
  onValueChange: (state: State) => void;
  /** For the panels that show a time in notes: the tempo of the loop. */
  tempo?: Tempo;
  value: State;
}

/** A device the chain can hold: its description, its engine and its panel. */
interface ChainDevice {
  create: (
    ctx: BaseAudioContext,
    state: AnyState,
    context?: DeviceContext
  ) => DemoEngine<AnyState>;
  device: Device<readonly ParameterDescriptor[]>;
  Panel: ComponentType<ChainPanelProps<AnyState>>;
  /** How wide its panel is drawn in the row. */
  width: string;
}

/** Pairs a device with its engine and its panel, checked against each other, for a list that holds them all. */
function chainDevice<const Parameters extends readonly ParameterDescriptor[]>(
  device: Device<Parameters>,
  create: (
    ctx: BaseAudioContext,
    state: DeviceState<Parameters>,
    context?: DeviceContext
  ) => DemoEngine<DeviceState<Parameters>>,
  Panel: ComponentType<ChainPanelProps<DeviceState<Parameters>>>,
  width: string
): ChainDevice {
  return {
    create: create as unknown as ChainDevice["create"],
    device: device as unknown as ChainDevice["device"],
    Panel: Panel as unknown as ChainDevice["Panel"],
    width,
  };
}

/** The devices of the library, by shelf. Any device goes in the same way: its description, its engine and its panel. */
const SHELVES = [
  {
    devices: [
      chainDevice(
        compressorDevice,
        createCompressorEngine,
        CompressorPanel,
        "w-96"
      ),
      chainDevice(limiterDevice, createLimiterEngine, LimiterPanel, "w-80"),
    ],
    label: "Dynamics",
  },
  {
    devices: [
      chainDevice(
        equalizerDevice,
        createEqualizerEngine,
        EqualizerPanel,
        "w-96"
      ),
      chainDevice(filterDevice, createFilterEngine, FilterPanel, "w-80"),
    ],
    label: "Tone",
  },
  {
    devices: [
      chainDevice(
        saturatorDevice,
        createSaturatorEngine,
        SaturatorPanel,
        "w-80"
      ),
      chainDevice(reduxDevice, createReduxEngine, ReduxPanel, "w-80"),
    ],
    label: "Distortion",
  },
  {
    devices: [
      chainDevice(delayDevice, createDelayEngine, DelayPanel, "w-80"),
      chainDevice(reverbDevice, createReverbEngine, ReverbPanel, "w-80"),
      chainDevice(chorusDevice, createChorusEngine, ChorusPanel, "w-80"),
    ],
    label: "Space",
  },
  {
    devices: [
      chainDevice(utilityDevice, createUtilityEngine, UtilityPanel, "w-80"),
    ],
    label: "Utility",
  },
];

const LIBRARY = SHELVES.map((shelf) => ({
  items: shelf.devices.map((entry) => entry.device),
  label: shelf.label,
}));

const DEVICES = new Map(
  SHELVES.flatMap((shelf) => shelf.devices).map((entry) => [
    entry.device.id,
    entry,
  ])
);

/** One device in the chain: its slot's id, the device it is, and its state. */
interface Slot {
  device: string;
  id: string;
  state: AnyState;
}

function slotOf(device: string, id: string): Slot | null {
  const entry = DEVICES.get(device);
  return entry ? { device, id, state: entry.device.defaults() } : null;
}

const START = [equalizerDevice.id, compressorDevice.id, delayDevice.id].flatMap(
  (device, index) => slotOf(device, `start-${index}`) ?? []
);

/**
 * The devices of the chain on the Web Audio API, one engine per slot, in
 * series from `input` to `output`, and the key at `sidechain` fed to every
 * engine that takes one. It follows the slots it is given: an engine is made
 * for a new slot, let go with its slot, told a slot's new state, and the
 * engines are wired again when their order changes.
 */
function createChainEngine(
  ctx: BaseAudioContext,
  initial: Slot[],
  context?: DeviceContext
): DemoEngine<Slot[]> {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sidechain = ctx.createGain();
  const running = new Map<
    string,
    { engine: DemoEngine<AnyState>; state: AnyState }
  >();
  let order: string[] = [];
  let tempo = context?.tempo;

  const wire = () => {
    input.disconnect();
    for (const { engine } of running.values()) {
      engine.output.disconnect();
    }
    let tail: AudioNode = input;
    for (const id of order) {
      const engine = running.get(id)?.engine;
      if (engine) {
        tail.connect(engine.input);
        tail = engine.output;
      }
    }
    tail.connect(output);
  };

  const release = (engine: DemoEngine<AnyState>) => {
    engine.output.disconnect();
    if (engine.sidechain) {
      sidechain.disconnect(engine.sidechain);
    }
    engine.dispose();
  };

  const start = (slot: Slot, next?: DeviceContext) => {
    const create = DEVICES.get(slot.device)?.create;
    if (!create) {
      return;
    }
    const engine = create(ctx, slot.state, next);
    if (engine.sidechain) {
      sidechain.connect(engine.sidechain);
    }
    running.set(slot.id, { engine, state: slot.state });
  };

  const update = (slots: Slot[], next?: DeviceContext) => {
    const retimed = next?.tempo !== tempo;
    tempo = next?.tempo;
    const ids = new Set(slots.map((slot) => slot.id));
    for (const [id, { engine }] of running) {
      if (!ids.has(id)) {
        release(engine);
        running.delete(id);
      }
    }
    for (const slot of slots) {
      const current = running.get(slot.id);
      if (!current) {
        start(slot, next);
      } else if (current.state !== slot.state || retimed) {
        current.engine.update(slot.state, next);
        current.state = slot.state;
      }
    }
    const nextOrder = slots
      .map((slot) => slot.id)
      .filter((id) => running.has(id));
    if (nextOrder.join() !== order.join()) {
      order = nextOrder;
      wire();
    }
  };

  update(initial, context);
  return {
    dispose: () => {
      input.disconnect();
      for (const { engine } of running.values()) {
        release(engine);
      }
      running.clear();
    },
    input,
    output,
    sidechain,
    update,
  };
}

interface ChainSlotProps {
  onChange: (id: string, state: AnyState) => void;
  slot: Slot;
  tempo: Tempo;
}

function ChainSlot({ onChange, slot, tempo }: ChainSlotProps) {
  const entry = DEVICES.get(slot.device);
  const change = useCallback(
    (state: AnyState) => onChange(slot.id, state),
    [onChange, slot.id]
  );
  const toggle = useCallback(
    (enabled: boolean) => {
      if (entry) {
        onChange(
          slot.id,
          entry.device.set(slot.state as never, "enabled", enabled) as AnyState
        );
      }
    },
    [entry, onChange, slot.id, slot.state]
  );
  if (!entry) {
    return null;
  }
  const { Panel } = entry;
  return (
    <DeviceChainSlot
      enabled={slot.state.enabled === true}
      onEnabledChange={toggle}
      title={entry.device.name}
      value={slot.id}
    >
      <Panel
        className={entry.width}
        onValueChange={change}
        tempo={tempo}
        value={slot.state}
      >
        <DeviceChainSlotControls />
      </Panel>
    </DeviceChainSlot>
  );
}

/**
 * A track's devices in a row, with the library beside them. Drag a device from
 * the library to where it goes in the chain, or mark one and press Enter; drag
 * a device by its header to move it, or press Left or Right on its grip. Play
 * the loop: it goes through the devices in the order they are drawn, each its
 * own panel over the real engine, and a compressor switched to its sidechain
 * ducks it with the kick.
 */
export default function BlockDeviceChain() {
  const [slots, setSlots] = useState<Slot[]>(START);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const search = useRef<HTMLInputElement>(null);
  const made = useRef(START.length);
  const master = useMasterBus(MASTER_VOLUME);
  const { tempo } = useDeviceLoop({
    create: createChainEngine,
    destination: master,
    key: true,
    state: slots,
  });

  const add = useCallback((device: string, index?: number) => {
    const slot = slotOf(device, `${device}-${made.current}`);
    if (!slot) {
      return;
    }
    made.current += 1;
    setSlots((current) => {
      const at = index ?? current.length;
      return [...current.slice(0, at), slot, ...current.slice(at)];
    });
  }, []);
  const pick = useCallback((device: string) => add(device), [add]);
  const move = useCallback((id: string, index: number) => {
    setSlots((current) => {
      const moved = current.find((slot) => slot.id === id);
      if (!moved) {
        return current;
      }
      const rest = current.filter((slot) => slot.id !== id);
      return [...rest.slice(0, index), moved, ...rest.slice(index)];
    });
  }, []);
  const remove = useCallback((id: string) => {
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }, []);
  const change = useCallback((id: string, state: AnyState) => {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, state } : slot))
    );
  }, []);
  const browse = useCallback(() => {
    setLibraryOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  }, []);
  const order = useMemo(() => slots.map((slot) => slot.id), [slots]);

  return (
    <div className="cn-audio-panel @container/chain w-full min-w-0 overflow-hidden border bg-card">
      {/* Side by side when there is room; narrower, the library sits over the chain and folds to a bar. */}
      <div className="flex flex-col @2xl/chain:h-96 @2xl/chain:flex-row">
        <DeviceBrowser
          className="@max-2xl/chain:h-60 @max-2xl/chain:w-full @max-2xl/chain:border-e-0 @max-2xl/chain:border-b @max-2xl/chain:data-folded:h-auto @max-2xl/chain:data-folded:flex-row @max-2xl/chain:data-folded:justify-center @max-2xl/chain:data-folded:*:rotate-0 @max-2xl/chain:data-folded:*:[writing-mode:horizontal-tb]"
          onOpenChange={setLibraryOpen}
          onPick={pick}
          open={libraryOpen}
          searchRef={search}
          shelves={LIBRARY}
        />
        <DeviceChain
          aria-label="Devices"
          className="h-96 flex-1 bg-muted/30 @2xl/chain:h-auto"
          onAdd={add}
          onMove={move}
          onRemove={remove}
          order={order}
        >
          {slots.map((slot) => (
            <ChainSlot
              key={slot.id}
              onChange={change}
              slot={slot}
              tempo={tempo}
            />
          ))}
          <DeviceChainAdd onClick={browse} />
        </DeviceChain>
      </div>
    </div>
  );
}
