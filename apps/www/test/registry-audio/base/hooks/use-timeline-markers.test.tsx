import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTimelineMarkers } from "@/registry-audio/bases/base/hooks/use-timeline-markers";
import {
  type ArrangementCommand,
  apply,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";

function setup(position = 4) {
  let state = createArrangementState({
    colors: 5,
    duration: 32,
    initialTracks: [{ color: 0, id: "a", name: "A" }],
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  });
  const dispatch = (command: ArrangementCommand) => {
    state = apply(state, command);
    return state;
  };
  const jumps: number[] = [];
  const plays: number[] = [];
  const view = renderHook(() =>
    useTimelineMarkers({
      dispatch,
      getPosition: () => position,
      onJump: (at) => jumps.push(at),
      onPlay: (at) => plays.push(at),
      step: 0.5,
    })
  );
  return { doc: () => state.doc, jumps, plays, view };
}

describe("useTimelineMarkers", () => {
  test("a locator goes at the cursor, and takes a name and its leave", () => {
    const { doc, view } = setup();
    act(() => {
      view.result.current.addLocator();
    });
    expect(doc().locators.map((locator) => locator.at)).toEqual([4]);
    const id = doc().locators[0]?.id ?? "";
    act(() => {
      view.result.current.locator.onRename(id, "Verse");
    });
    expect(doc().locators[0]?.name).toBe("Verse");
    act(() => {
      view.result.current.locator.onMove(id, 8);
    });
    expect(doc().locators[0]?.at).toBe(8);
    expect(view.result.current.locator.step).toBe(0.5);
    act(() => {
      view.result.current.locator.onRemove(id);
    });
    expect(doc().locators).toEqual([]);
  });

  test("a time signature goes at the cursor and opens to be typed", () => {
    const { doc, view } = setup();
    act(() => view.result.current.addSignature());
    const [change] = doc().signatures;
    expect(change?.at).toBe(4);
    expect(view.result.current.editingSignature).toBe(change?.id ?? "");
    act(() => {
      view.result.current.signature.onSet(change?.id ?? "", 7, 8);
    });
    expect(doc().signatures[0]).toMatchObject({ beatsPerBar: 7, beatUnit: 8 });
    act(() => view.result.current.signature.onEditingChange(null));
    expect(view.result.current.editingSignature).toBeNull();
    act(() => {
      view.result.current.signature.onRemove(change?.id ?? "");
    });
    expect(doc().signatures).toEqual([]);
  });

  test("a press jumps, a double-click plays, and the arrows move a marker by the grid", () => {
    const { jumps, plays, view } = setup();
    view.result.current.locator.onJump(8);
    expect(jumps).toEqual([8]);
    view.result.current.locator.onPlay(8);
    expect(plays).toEqual([8]);
    expect(view.result.current.signature.step).toBe(0.5);
  });
});
