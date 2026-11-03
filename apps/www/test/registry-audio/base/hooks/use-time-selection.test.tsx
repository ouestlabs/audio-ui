import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTimeSelection } from "@/registry-audio/bases/base/hooks/use-time-selection";
import type { Clipping } from "@/registry-audio/bases/base/lib/arrangement";
import type { ArrangementCommand } from "@/registry-audio/bases/base/lib/arrangement-state";

const TRACKS = [
  { color: 0, id: "a", name: "A" },
  { color: 1, id: "b", name: "B" },
];
const TIME = { range: [2, 4] as const, tracks: ["a"] };
const COPY: Clipping = { length: 2, parts: [] };

function setup(selectedIds: string[] = []) {
  const sent: ArrangementCommand[] = [];
  const dispatch = mock((command: ArrangementCommand) => sent.push(command));
  const view = renderHook(() =>
    useTimeSelection({
      bar: 2,
      clips: [],
      copyOf: () => COPY,
      dispatch,
      getPosition: () => 8,
      selectedIds,
      selectedTracks: [],
      tracks: TRACKS,
    })
  );
  return { sent, view };
}

/** A key press with Cmd unless said otherwise. */
const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) => {
  const preventDefault = mock(() => undefined);
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
    key,
    metaKey: true,
    preventDefault,
    shiftKey: false,
    target: null,
    ...modifiers,
  } as unknown as KeyboardEvent;
};

describe("useTimeSelection", () => {
  test("a key with no time selected and nothing to do is left to the host", () => {
    const { sent, view } = setup();
    for (const key of ["d", "j", "l", "v"]) {
      expect(view.result.current.handleKey(press(key))).toBe(false);
    }
    expect(
      view.result.current.handleKey(press("Delete", { metaKey: false }))
    ).toBe(false);
    expect(sent).toEqual([]);
  });

  test("Delete empties the time selected; with Cmd and Shift it takes the time out and lets go", () => {
    const { sent, view } = setup();
    act(() => view.result.current.setTime(TIME));
    act(() => {
      view.result.current.handleKey(press("Delete", { metaKey: false }));
    });
    expect(sent.at(-1)).toEqual({ time: TIME, type: "clear-time" });
    expect(view.result.current.time).toEqual(TIME);
    act(() => {
      view.result.current.handleKey(press("Delete", { shiftKey: true }));
    });
    expect(sent.at(-1)).toEqual({ from: 2, to: 4, type: "remove-time" });
    expect(view.result.current.time).toBeNull();
  });

  test("Cmd+D puts the time after itself, and the selection moves onto it; with Shift, in one step with the time it opens", () => {
    const { sent, view } = setup();
    act(() => view.result.current.setTime(TIME));
    act(() => {
      view.result.current.handleKey(press("d", { shiftKey: true }));
    });
    expect(sent).toEqual([
      {
        commands: [
          { at: 4, length: 2, type: "insert-time" },
          { at: 4, clipping: COPY, track: "a", type: "paste" },
        ],
        type: "batch",
      },
    ]);
    expect(view.result.current.time?.range).toEqual([4, 6]);
  });

  test("Cmd+C then Cmd+V pastes at the cursor, on the top of the time selected", () => {
    const { sent, view } = setup();
    act(() => view.result.current.setTime(TIME));
    act(() => {
      view.result.current.handleKey(press("c"));
    });
    act(() => {
      view.result.current.handleKey(press("v"));
    });
    expect(sent).toEqual([
      {
        commands: [{ at: 8, clipping: COPY, track: "a", type: "paste" }],
        type: "batch",
      },
    ]);
  });

  test("Cmd+X on selected clips removes them all, in one step", () => {
    const { sent, view } = setup(["one", "two"]);
    act(() => {
      view.result.current.handleKey(press("x"));
    });
    expect(sent).toEqual([
      {
        commands: [
          { id: "one", type: "remove-clip" },
          { id: "two", type: "remove-clip" },
        ],
        type: "batch",
      },
    ]);
  });

  test("Cmd+I opens a bar at the cursor, or as long as the time selected", () => {
    const { sent, view } = setup();
    act(() => {
      view.result.current.handleKey(press("i"));
    });
    expect(sent.at(-1)).toEqual({ at: 8, length: 2, type: "insert-time" });
    act(() => view.result.current.setTime({ range: [0, 3], tracks: ["a"] }));
    act(() => {
      view.result.current.handleKey(press("i"));
    });
    expect(sent.at(-1)).toEqual({ at: 8, length: 3, type: "insert-time" });
  });

  test("Cmd+L loops the time selected, Cmd+J consolidates it, Cmd+Alt+F fades it by the key's place", () => {
    const { sent, view } = setup();
    act(() => view.result.current.setTime(TIME));
    act(() => {
      view.result.current.handleKey(press("l"));
      view.result.current.handleKey(press("j"));
      view.result.current.handleKey(press("ƒ", { altKey: true, code: "KeyF" }));
    });
    expect(sent).toEqual([
      { loop: { on: true, range: [2, 4] }, type: "set-loop" },
      { time: TIME, type: "consolidate-time" },
      { time: TIME, type: "fade-time" },
    ]);
  });

  test("a press on bare lane lets go of the time selected", () => {
    const { view } = setup();
    act(() => view.result.current.setTime(TIME));
    act(() => view.result.current.pressLane("b"));
    expect(view.result.current.time).toBeNull();
  });

  test("in a field, the keys are the field's own", () => {
    const { sent, view } = setup(["one"]);
    const field = document.createElement("input");
    expect(view.result.current.handleKey(press("x", { target: field }))).toBe(
      false
    );
    expect(sent).toEqual([]);
  });
});
