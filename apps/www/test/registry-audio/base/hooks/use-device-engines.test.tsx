import { describe, expect, test } from "bun:test";
import type { DeviceContext } from "@audio-ui/core/device";
import { renderHook } from "@testing-library/react";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";

interface State {
  level: number;
}

/** A destination on a context of its own, and engines that write down what happens to them. */
function setup() {
  const log: string[] = [];
  let made = 0;
  const destination = { context: {} } as AudioNode;
  const tempo = (context?: DeviceContext) =>
    context ? ` at ${context.tempo.bpm} bpm` : "";
  const create = (
    _ctx: BaseAudioContext,
    state: State,
    context?: DeviceContext
  ) => {
    made += 1;
    const name = `e${made}`;
    log.push(`${name} made at ${state.level}${tempo(context)}`);
    return {
      dispose: () => log.push(`${name} disposed`),
      output: {
        connect: (to: AudioNode) => {
          log.push(`${name} into ${to === destination ? "destination" : "?"}`);
        },
      } as unknown as AudioNode,
      update: (next: State, host?: DeviceContext) =>
        log.push(`${name} at ${next.level}${tempo(host)}`),
    };
  };
  return { create, destination, log };
}

const at = (bpm: number): DeviceContext => ({
  tempo: { beatsPerBar: 4, beatUnit: 4, bpm },
});

describe("useDeviceEngines", () => {
  test("none while there is no destination, then one into it, following the state", () => {
    const { create, destination, log } = setup();
    const view = renderHook(
      (props: { destination: AudioNode | null; state: State }) =>
        useDeviceEngines({ create, ...props }),
      {
        initialProps: {
          destination: null as AudioNode | null,
          state: { level: 1 },
        },
      }
    );
    expect(view.result.current).toHaveLength(0);
    view.rerender({ destination, state: { level: 2 } });
    expect(view.result.current).toHaveLength(1);
    view.rerender({ destination, state: { level: 3 } });
    expect(log).toEqual([
      "e1 made at 2",
      "e1 into destination",
      "e1 at 2",
      "e1 at 3",
    ]);
  });

  test("a new destination disposes them and makes new ones from the latest state, and so does unmounting; a disposed one is never updated", () => {
    const { create, destination, log } = setup();
    const view = renderHook(
      (props: { destination: AudioNode; state: State }) =>
        useDeviceEngines({ create, ...props }),
      { initialProps: { destination, state: { level: 1 } } }
    );
    const other = { context: {} } as AudioNode;
    view.rerender({ destination: other, state: { level: 3 } });
    view.unmount();
    expect(log).toEqual([
      "e1 made at 1",
      "e1 into destination",
      "e1 at 1",
      "e1 disposed",
      "e2 made at 3",
      "e2 into ?",
      "e2 at 3",
      "e2 disposed",
    ]);
  });

  test("each is made and updated with the host's context, and a new count makes them again", () => {
    const { create, destination, log } = setup();
    const view = renderHook(
      (props: { context: DeviceContext; count: number }) =>
        useDeviceEngines({
          create,
          destination,
          state: { level: 1 },
          ...props,
        }),
      { initialProps: { context: at(90), count: 2 } }
    );
    view.rerender({ context: at(120), count: 2 });
    view.rerender({ context: at(120), count: 1 });
    expect(view.result.current).toHaveLength(1);
    expect(log).toEqual([
      "e1 made at 1 at 90 bpm",
      "e1 into destination",
      "e2 made at 1 at 90 bpm",
      "e2 into destination",
      "e1 at 1 at 90 bpm",
      "e2 at 1 at 90 bpm",
      "e1 at 1 at 120 bpm",
      "e2 at 1 at 120 bpm",
      "e1 disposed",
      "e2 disposed",
      "e3 made at 1 at 120 bpm",
      "e3 into destination",
      "e3 at 1 at 120 bpm",
    ]);
  });
});
