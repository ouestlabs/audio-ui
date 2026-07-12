import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Ruler } from "./ruler";

/** 8-step timeline, 25px/step at a 200×100 rect, so drag-threshold and step-boundary assertions stay exact. */
function renderRuler(props: Partial<Ruler.RootProps> = {}) {
  const onSeek = mock(() => undefined);
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Ruler.Root
      onSeek={onSeek}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      totalSteps={8}
      {...props}
    >
      <Ruler.Track data-testid="track">
        <Ruler.LoopRegion data-testid="region">
          <Ruler.LoopRegionHandle data-testid="start-handle" side="start" />
          <Ruler.LoopRegionHandle data-testid="end-handle" side="end" />
        </Ruler.LoopRegion>
      </Ruler.Track>
    </Ruler.Root>
  );
  const track = view.getByTestId("track");
  mockRect(track, { height: 100, width: 200 });
  return {
    endHandle: view.queryByTestId("end-handle"),
    onSeek,
    onValueChange,
    onValueCommit,
    queryRegion: () => view.queryByTestId("region"),
    startHandle: view.queryByTestId("start-handle"),
    track,
    view,
  };
}

describe("Ruler rendering", () => {
  test("renders no region when the value is null", () => {
    const { queryRegion } = renderRuler();
    expect(queryRegion()).toBeNull();
  });

  test("renders a region when a defaultValue is given", () => {
    const { queryRegion } = renderRuler({ defaultValue: { end: 4, start: 2 } });
    expect(queryRegion()).not.toBeNull();
  });
});

describe("Ruler click-to-seek vs. drag-to-create (track 200×100, 8 steps)", () => {
  test("clicking the track (pointerdown/up with no movement) seeks and creates no region", () => {
    const { onSeek, onValueCommit, queryRegion, track } = renderRuler();
    fireEvent.pointerDown(track, { clientX: 112, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 112, clientY: 10, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(4);
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(queryRegion()).toBeNull();
  });

  test("a sub-threshold move after pointerdown still resolves as a seek", () => {
    const { onSeek, onValueChange, track } = renderRuler();
    fireEvent.pointerDown(track, { clientX: 125, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 126, clientY: 10, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(track, { clientX: 126, clientY: 10, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(5);
  });

  test("dragging past the threshold draws a region and never seeks", () => {
    const { onSeek, onValueChange, onValueCommit, track } = renderRuler();
    fireEvent.pointerDown(track, { clientX: 25, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 175, clientY: 10, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith({ end: 8, start: 1 });

    fireEvent.pointerUp(track, { clientX: 175, clientY: 10, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 8, start: 1 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  test("dragging left of the anchor extends the region to the left", () => {
    const { onValueChange, track } = renderRuler();
    fireEvent.pointerDown(track, { clientX: 125, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 25, clientY: 10, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith({ end: 6, start: 1 });
  });

  test("ignores pointer input when disabled", () => {
    const { onSeek, onValueCommit, track } = renderRuler({ disabled: true });
    fireEvent.pointerDown(track, { clientX: 112, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 112, clientY: 10, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});

describe("Ruler editing an existing region (track 200×100, 8 steps)", () => {
  test("dragging the region body moves it, streaming onValueChange and committing on release", () => {
    const { onValueChange, onValueCommit, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });
    const region = queryRegion() as HTMLElement;

    fireEvent.pointerDown(region, { clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(region, { clientX: 175, clientY: 10, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith({ end: 7, start: 5 });

    fireEvent.pointerUp(region, { clientX: 175, clientY: 10, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 7, start: 5 });
  });

  test("a sub-threshold move on the region body never starts a move drag", () => {
    const { onValueChange, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });
    const region = queryRegion() as HTMLElement;

    fireEvent.pointerDown(region, { clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(region, { clientX: 101, clientY: 10, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("dragging the end handle resizes the region's end edge only", () => {
    const { endHandle, onValueChange } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });

    fireEvent.pointerDown(endHandle as HTMLElement, {
      clientX: 100,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(endHandle as HTMLElement, {
      clientX: 150,
      clientY: 10,
      pointerId: 1,
    });
    expect(onValueChange).toHaveBeenLastCalledWith({ end: 6, start: 2 });
  });

  test("dragging the start handle resizes the region's start edge only", () => {
    const { onValueChange, startHandle } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });

    fireEvent.pointerDown(startHandle as HTMLElement, {
      clientX: 100,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(startHandle as HTMLElement, {
      clientX: 50,
      clientY: 10,
      pointerId: 1,
    });
    expect(onValueChange).toHaveBeenLastCalledWith({ end: 4, start: 0 });
  });

  test("double-clicking the region clears it back to null", () => {
    const { onValueCommit, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });
    fireEvent.doubleClick(queryRegion() as HTMLElement);
    expect(onValueCommit).toHaveBeenLastCalledWith(null);
  });
});

describe("Ruler keyboard", () => {
  test("Enter on the track creates a default region when none exists", () => {
    const { onValueCommit, track } = renderRuler();
    fireEvent.keyDown(track, { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 1, start: 0 });
  });

  test("Enter on the track is a no-op once a region already exists", () => {
    const { onValueCommit, track } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });
    fireEvent.keyDown(track, { key: "Enter" });
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  test("ArrowRight/ArrowLeft move the region by one step", () => {
    const { onValueCommit, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });
    const region = queryRegion() as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 5, start: 3 });
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 4, start: 2 });
  });

  test("Shift+ArrowRight/Left resize the end edge, floored at minLength", () => {
    const { onValueCommit, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
      minLength: 1,
    });
    const region = queryRegion() as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight", shiftKey: true });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 5, start: 2 });
    fireEvent.keyDown(region, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(region, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(region, { key: "ArrowLeft", shiftKey: true });
    expect(onValueCommit).toHaveBeenLastCalledWith({ end: 3, start: 2 });
  });

  test("Delete/Backspace clears the focused region", () => {
    const { onValueCommit, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
    });
    fireEvent.keyDown(queryRegion() as HTMLElement, { key: "Delete" });
    expect(onValueCommit).toHaveBeenLastCalledWith(null);
  });

  test("ignores keys when disabled", () => {
    const { onValueCommit, queryRegion } = renderRuler({
      defaultValue: { end: 4, start: 2 },
      disabled: true,
    });
    const region = queryRegion() as HTMLElement;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(region.tabIndex).toBe(-1);
  });
});
