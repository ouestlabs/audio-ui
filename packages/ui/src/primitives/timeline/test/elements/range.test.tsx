import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.ts";
import { Timeline } from "../../../../entries/timeline.ts";
import { lastCall } from "../helpers.tsx";

const seconds = (value: number) => `${value}s`;

/**
 * A range on a 100-unit timeline whose lane is 200px wide: 2px per unit,
 * fitted. Extra props go to the range, `rootProps` to the root.
 */
function renderRange(
  props: Timeline.Range.Props = {},
  rootProps: Timeline.Root.Props = {},
  laneProps: Timeline.Lane.Props = {}
) {
  const onSeek = mock((_value: number) => undefined);
  const onValueChange = mock(
    (
      _value: Timeline.Range.Value,
      _details: Timeline.Range.ChangeEventDetails
    ) => undefined
  );
  const onValueCommitted = mock(
    (
      _value: Timeline.Range.Value,
      _details: Timeline.Range.CommitEventDetails
    ) => undefined
  );
  const view = render(
    <Timeline.Root duration={100} onPositionChange={onSeek} {...rootProps}>
      <Timeline.Lane data-testid="lane" {...laneProps}>
        <Timeline.Range
          aria-label="Loop"
          data-testid="range"
          defaultValue={[20, 60]}
          getAriaValueText={seconds}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          {...props}
        >
          <Timeline.RangeHandle
            aria-label="Loop start"
            data-testid="start"
            edge="start"
          />
          <Timeline.RangeHandle
            aria-label="Loop end"
            data-testid="end"
            edge="end"
          />
        </Timeline.Range>
      </Timeline.Lane>
    </Timeline.Root>
  );
  const lane = view.getByTestId("lane");
  mockRect(lane, { bottom: 20, height: 20, right: 200, width: 200 });
  const range = view.getByTestId("range");
  return {
    end: view.getByTestId("end"),
    endInput: view.getByLabelText("Loop end") as HTMLInputElement,
    lane,
    onSeek,
    onValueChange,
    onValueCommitted,
    range,
    rangeInput: view.queryByLabelText("Loop") as HTMLInputElement,
    span: () => [
      range.style.getPropertyValue("--timeline-offset"),
      range.style.getPropertyValue("--timeline-length"),
    ],
    start: view.getByTestId("start"),
    startInput: view.getByLabelText("Loop start") as HTMLInputElement,
    view,
  };
}

/** Press at `from`, move to `to`, release, with optional modifier keys. */
function drag(
  element: HTMLElement,
  from: number,
  to: number,
  init: { metaKey?: boolean } = {}
) {
  fireEvent.pointerDown(element, { clientX: from, pointerId: 1, ...init });
  fireEvent.pointerMove(element, { clientX: to, pointerId: 1, ...init });
  fireEvent.pointerUp(element, { clientX: to, pointerId: 1, ...init });
}

describe("Timeline.Range", () => {
  test("sits from its start, as long as it lasts", () => {
    expect(renderRange().span()).toEqual(["20", "40"]);
  });

  test("covers the whole timeline by default", () => {
    expect(renderRange({ defaultValue: undefined }).span()).toEqual([
      "0",
      "100",
    ]);
  });

  test("orders its edges", () => {
    expect(renderRange({ value: [70, 30] }).span()).toEqual(["30", "40"]);
  });

  test("dragging the body moves it, keeping its length, and commits on release", () => {
    const { onValueChange, onValueCommitted, range, span } = renderRange();
    fireEvent.pointerDown(range, { clientX: 80, pointerId: 1 });
    expect(range.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(range, { clientX: 100, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      [30, 70],
      expect.objectContaining({ edge: "both", reason: "drag" }),
    ]);
    fireEvent.pointerUp(range, { clientX: 100, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      [30, 70],
      expect.objectContaining({ edge: "both", reason: "drag" }),
    ]);
    expect(span()).toEqual(["30", "40"]);
  });

  test("moves on the grid, unless Cmd/Ctrl is held", () => {
    const grid = { snapStep: 8 };
    const snapped = renderRange({ defaultValue: [20, 60] }, grid);
    drag(snapped.range, 80, 91);
    // 5.5 units: 20 lands on the line at 24 rather than a step away at 28
    expect(snapped.span()).toEqual(["24", "40"]);
    snapped.view.unmount();

    const free = renderRange({ defaultValue: [20, 60] }, grid);
    drag(free.range, 80, 91, { metaKey: true });
    expect(free.span()).toEqual(["25.5", "40"]);
  });

  test("a press on the range never reaches the lane underneath", () => {
    const onLanePress = mock(() => undefined);
    const { onValueChange, range } = renderRange(
      { drawable: true },
      {},
      { onPointerDown: onLanePress }
    );
    drag(range, 80, 80);
    expect(onLanePress).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("drawable: dragging across empty lane draws a new range", () => {
    const { lane, onValueChange, onValueCommitted, span } = renderRange({
      drawable: true,
    });
    drag(lane, 140, 180);
    expect(lastCall(onValueChange)).toEqual([
      [70, 90],
      expect.objectContaining({ reason: "draw" }),
    ]);
    expect(lastCall(onValueCommitted)[1].reason).toBe("draw");
    expect(span()).toEqual(["70", "20"]);
  });

  test("drawable: draws leftwards too, on the grid, at least minLength long", () => {
    const { lane, span } = renderRange(
      { drawable: true, minLength: 4 },
      { snapStep: 5 }
    );
    drag(lane, 101, 61);
    expect(span()).toEqual(["30", "20"]);
    drag(lane, 61, 61);
    expect(span()).toEqual(["30", "4"]);
  });

  test("without drawable, empty lane is left alone", () => {
    const { lane, onValueChange } = renderRange();
    drag(lane, 140, 180);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("its own input moves it from the keyboard, by the step", () => {
    const { onValueCommitted, rangeInput } = renderRange({}, { snapStep: 5 });
    expect(rangeInput.getAttribute("aria-valuetext")).toBe("20s to 60s");
    fireEvent.keyDown(rangeInput, { key: "ArrowRight" });
    expect(lastCall(onValueCommitted)).toEqual([
      [25, 65],
      expect.objectContaining({ edge: "both", reason: "keyboard" }),
    ]);
    fireEvent.keyDown(rangeInput, { key: "End" });
    expect(lastCall(onValueCommitted)[0]).toEqual([60, 100]);
  });

  test("movable={false} keeps it in place and has no input of its own", () => {
    const { onValueChange, range, view } = renderRange({ movable: false });
    drag(range, 80, 120);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(view.queryByLabelText("Loop")).toBeNull();
  });

  test("a controlled range that lags doesn't pull back mid-drag", () => {
    const { range, span } = renderRange({ value: [20, 60] });
    fireEvent.pointerDown(range, { clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(range, { clientX: 100, pointerId: 1 });
    expect(span()).toEqual(["30", "40"]);
    fireEvent.pointerUp(range, { clientX: 100, pointerId: 1 });
    expect(span()).toEqual(["20", "40"]);
  });

  test("eventDetails.cancel() rejects the change", () => {
    const { range, span } = renderRange({
      onValueChange: (_value, details) => details.cancel(),
    });
    drag(range, 80, 100);
    expect(span()).toEqual(["20", "40"]);
  });

  test("follows the zoom: dragging is measured in px per unit", () => {
    const { range, span } = renderRange({}, { zoom: 10 });
    drag(range, 300, 350);
    expect(span()).toEqual(["25", "40"]);
  });

  test("inherits disabled from the root", () => {
    const { onValueChange, range, rangeInput } = renderRange(
      {},
      { disabled: true }
    );
    drag(range, 80, 100);
    fireEvent.keyDown(rangeInput, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(range.hasAttribute("data-disabled")).toBe(true);
  });

  test("must be used within a lane", () => {
    expect(() =>
      render(
        <Timeline.Root>
          <Timeline.Range />
        </Timeline.Root>
      )
    ).toThrow("Timeline.Range must be used within a Timeline lane");
  });
});

describe("Timeline.RangeHandle", () => {
  test("holds a named input bounded by the other edge", () => {
    const { endInput, startInput } = renderRange({ minLength: 1 });
    expect([startInput.min, startInput.max, startInput.value]).toEqual([
      "0",
      "59",
      "20",
    ]);
    expect([endInput.min, endInput.max, endInput.value]).toEqual([
      "21",
      "100",
      "60",
    ]);
    expect(startInput.getAttribute("aria-valuetext")).toBe("20s");
  });

  test("dragging a handle resizes its edge only, on the grid", () => {
    const { end, onValueCommitted, start } = renderRange({}, { snapStep: 5 });
    drag(start, 40, 23);
    expect(lastCall(onValueCommitted)).toEqual([
      [10, 60],
      expect.objectContaining({ edge: "start", reason: "drag" }),
    ]);
    drag(end, 120, 147);
    expect(lastCall(onValueCommitted)[0]).toEqual([10, 75]);
  });

  test("an edge stops a minimum length short of the other", () => {
    const { span, start } = renderRange({ minLength: 10 });
    drag(start, 40, 900);
    expect(span()).toEqual(["50", "10"]);
  });

  test("a press focuses the handle's input", () => {
    const { start, startInput } = renderRange();
    fireEvent.pointerDown(start, { clientX: 40, pointerId: 1 });
    expect(document.activeElement).toBe(startInput);
  });

  test("arrow keys move its edge by the step, Shift by the large step", () => {
    const { endInput, onValueCommitted } = renderRange({}, { snapStep: 2 });
    fireEvent.keyDown(endInput, { key: "ArrowLeft" });
    expect(lastCall(onValueCommitted)).toEqual([
      [20, 58],
      expect.objectContaining({ edge: "end", reason: "keyboard" }),
    ]);
    fireEvent.keyDown(endInput, { key: "ArrowRight", shiftKey: true });
    expect(lastCall(onValueCommitted)[0]).toEqual([20, 78]);
  });

  test("must be used within a range", () => {
    expect(() =>
      render(
        <Timeline.Root>
          <Timeline.Lane>
            <Timeline.RangeHandle edge="start" />
          </Timeline.Lane>
        </Timeline.Root>
      )
    ).toThrow("Timeline.RangeHandle must be used within Timeline.Range");
  });
});
