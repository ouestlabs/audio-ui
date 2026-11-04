import { describe, expect, mock, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useTimelineCursor } from "@/registry-audio/bases/base/hooks/use-timeline-cursor";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";

const clip = (id: string, track: string, start: number, length: number) =>
  ({
    id,
    name: id,
    sourceLength: length,
    track,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start },
  }) as Arranged;

const CLIPS = [clip("one", "a", 4, 2), clip("two", "b", 10, 4)];
const TRACKS = [
  { color: 0, id: "a", name: "A" },
  { color: 1, id: "b", name: "B" },
];

function setup(position = 8, selectedTracks: string[] = []) {
  const onAddLocator = mock(() => undefined);
  const onPickTrack = mock((_id: string) => undefined);
  const onSeek = mock((_seconds: number) => undefined);
  const { result } = renderHook(() =>
    useTimelineCursor({
      clips: CLIPS,
      duration: 32,
      getPosition: () => position,
      locators: [{ at: 7 }],
      onAddLocator,
      onPickTrack,
      onSeek,
      selectedIds: [],
      selectedTracks,
      step: 0.5,
      tracks: TRACKS,
    })
  );
  return { onAddLocator, onPickTrack, onSeek, result };
}

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: () => undefined,
    shiftKey: false,
    stopPropagation: () => undefined,
    target: null,
    ...modifiers,
  }) as unknown as KeyboardEvent;

describe("useTimelineCursor", () => {
  test("M adds a locator, alone", () => {
    const { onAddLocator, result } = setup();
    expect(result.current.handleKey(press("m"))).toBe(true);
    expect(onAddLocator).toHaveBeenCalledTimes(1);
    expect(result.current.handleKey(press("m", { metaKey: true }))).toBe(false);
  });

  test("in a field, M is the field's own", () => {
    const { onAddLocator, result } = setup();
    const field = document.createElement("input");
    expect(result.current.handleKey(press("m", { target: field }))).toBe(false);
    expect(onAddLocator).not.toHaveBeenCalled();
  });

  test("Alt and the arrows jump to the next locator or clip edge", () => {
    const { onSeek, result } = setup();
    result.current.handleKey(press("ArrowLeft", { altKey: true }));
    expect(onSeek).toHaveBeenLastCalledWith(7);
    result.current.handleKey(press("ArrowRight", { altKey: true }));
    expect(onSeek).toHaveBeenLastCalledWith(10);
  });

  test("with a track picked, Alt and the arrows read its clips alone", () => {
    const { onSeek, result } = setup(8, ["a"]);
    expect(
      result.current.handleKey(press("ArrowRight", { altKey: true }))
    ).toBe(false);
    expect(onSeek).not.toHaveBeenCalled();
  });

  test("the arrows move the cursor on the grid, Home and End to the ends", () => {
    const { onSeek, result } = setup(8);
    result.current.handleArrowKey(press("ArrowRight"));
    expect(onSeek).toHaveBeenLastCalledWith(8.5);
    result.current.handleArrowKey(press("ArrowLeft"));
    expect(onSeek).toHaveBeenLastCalledWith(7.5);
    result.current.handleArrowKey(press("End"));
    expect(onSeek).toHaveBeenLastCalledWith(14);
    result.current.handleArrowKey(press("Home"));
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });

  test("Up and Down pick the track above or below, and stop at the ends", () => {
    const { onPickTrack, result } = setup(0, ["a"]);
    result.current.handleArrowKey(press("ArrowDown"));
    expect(onPickTrack).toHaveBeenLastCalledWith("b");
    result.current.handleArrowKey(press("ArrowUp"));
    expect(onPickTrack).toHaveBeenLastCalledWith("a");
  });

  test("an arrow with a modifier is not the cursor's", () => {
    const { result } = setup();
    expect(
      result.current.handleArrowKey(press("ArrowLeft", { shiftKey: true }))
    ).toBe(false);
  });
});
