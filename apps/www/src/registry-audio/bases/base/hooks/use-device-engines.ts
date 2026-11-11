"use client";

import type { DeviceContext } from "@audio-ui/core/device";
import { useEffect, useRef, useState } from "react";
import type {
  EffectEngine,
  EngineFactory,
} from "@/registry-audio/bases/base/lib/device-engine";

/** What the hook needs of an engine, effect or instrument: an output, a state to follow, a way to let go. */
export type DeviceEngineLike<State> = Pick<
  EffectEngine<State>,
  "dispose" | "output" | "update"
>;

export interface UseDeviceEnginesOptions<State, Engine> {
  /** What the host knows, such as its tempo, given with each update. Memoize it: a new object updates every engine. */
  context?: DeviceContext;
  /** How many engines: one for an effect, one per voice for an instrument. @default 1 */
  count?: number;
  /** Makes one engine for the state it starts with: a device's `create<Name>Engine`. */
  create: EngineFactory<State, Engine>;
  /** Where every engine plays, such as the node of `useMasterBus`. The engines are made on its context once it is there, and made again when it changes; `null` makes none. */
  destination: AudioNode | null;
  /** The device's state: every engine follows it, whoever changed it. */
  state: State;
}

const NO_ENGINES: readonly never[] = [];

/**
 * The engines of a device on a page: `count` of them made with `create` into
 * `destination`, from the state of the moment, each following `state` (and
 * `context`) after that. They are disposed when the destination or the count
 * changes, and on unmount. Until the destination is there, or while it is
 * `null`, there are none.
 *
 * An update never reaches an engine already disposed: when a new destination
 * and a new state come in one render, only the new engines get the state.
 * Effects take one engine (`const [engine] = useDeviceEngines(...)`), and
 * `usePolyphony` takes one per voice.
 */
export function useDeviceEngines<
  State,
  Engine extends DeviceEngineLike<State>,
>({
  context,
  count = 1,
  create,
  destination,
  state,
}: UseDeviceEnginesOptions<State, Engine>): readonly Engine[] {
  const [engines, setEngines] = useState<readonly Engine[]>(NO_ENGINES);
  /** The engines playing now: those of a render may have just been disposed. */
  const live = useRef<readonly Engine[]>(NO_ENGINES);
  // The engines start from the state and the context they are made with; the effect below keeps them following.
  const latest = useRef({ context, create, state });
  latest.current = { context, create, state };

  useEffect(() => {
    if (!destination) {
      return;
    }
    const made = Array.from({ length: count }, () => {
      const { context: host, create: make, state: now } = latest.current;
      const engine = make(destination.context, now, host);
      engine.output.connect(destination);
      return engine;
    });
    live.current = made;
    setEngines(made);
    return () => {
      live.current = NO_ENGINES;
      for (const engine of made) {
        engine.dispose();
      }
      setEngines(NO_ENGINES);
    };
  }, [count, destination]);

  useEffect(() => {
    if (engines !== live.current) {
      return;
    }
    for (const engine of engines) {
      engine.update(state, context);
    }
  }, [context, engines, state]);

  return engines;
}
