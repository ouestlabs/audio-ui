import { describe, expect, test } from "bun:test";
import type { NoteTiming } from "@audio-ui/core/device";
import { act, renderHook } from "@testing-library/react";
import { usePolyphony } from "@/registry-audio/bases/base/hooks/use-polyphony";

interface State {
  level: number;
}

/** A destination on a context of its own, and engines that write down what happens to them. */
function setup() {
  const log: string[] = [];
  let made = 0;
  const destination = { context: {} } as AudioNode;
  const create = (_ctx: BaseAudioContext, state: State) => {
    made += 1;
    const name = `v${made}`;
    log.push(`${name} made at ${state.level}`);
    return {
      dispose: () => log.push(`${name} disposed`),
      noteOff: ({ id }: NoteTiming = {}) => log.push(`${name} off ${id}`),
      noteOn: (note: { pitch: number }, { id }: NoteTiming = {}) =>
        log.push(`${name} on ${note.pitch} ${id}`),
      output: {
        connect: (to: AudioNode) => {
          log.push(`${name} into ${to === destination ? "destination" : "?"}`);
        },
      } as unknown as AudioNode,
      update: (next: State) => log.push(`${name} at ${next.level}`),
    };
  };
  return { create, destination, log };
}

describe("usePolyphony", () => {
  test("no voice is made, and a note plays nowhere, until the destination is there", () => {
    const { create, log } = setup();
    const view = renderHook(() =>
      usePolyphony({ create, destination: null, state: { level: 1 } })
    );
    act(() => view.result.current.noteOn({ pitch: 60 }, "a"));
    expect(view.result.current.engines).toHaveLength(0);
    expect(log).toEqual([]);
  });

  test("its voices are made into the destination, follow the state, and take a note each", () => {
    const { create, destination, log } = setup();
    const view = renderHook(
      (props: { state: State }) =>
        usePolyphony({ create, destination, state: props.state, voices: 2 }),
      { initialProps: { state: { level: 1 } } }
    );
    expect(view.result.current.engines).toHaveLength(2);
    view.rerender({ state: { level: 2 } });
    act(() => {
      view.result.current.noteOn({ pitch: 60 }, "a");
      view.result.current.noteOn({ pitch: 64 }, "b");
      view.result.current.noteOn({ pitch: 67 }, "c");
      view.result.current.noteOff("b");
    });
    expect(log).toEqual([
      "v1 made at 1",
      "v1 into destination",
      "v2 made at 1",
      "v2 into destination",
      "v1 at 1",
      "v2 at 1",
      "v1 at 2",
      "v2 at 2",
      "v1 on 60 a",
      "v2 on 64 b",
      "v1 off a",
      "v1 on 67 c",
      "v2 off b",
    ]);
  });
});
