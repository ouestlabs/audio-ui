import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent } from "@testing-library/react";
import { createTestSource, lastCall, renderTimeline } from "../helpers.js";

const position = (playhead: HTMLElement) =>
  playhead.style.getPropertyValue("--timeline-offset");

describe("Timeline.Ruler pointer (100 units over 200px)", () => {
  test("a press jumps to the pointer, a drag scrubs, release commits", () => {
    const { onPositionChange, onPositionCommitted, playhead, ruler } =
      renderTimeline();

    fireEvent.pointerDown(ruler, { clientX: 60, pointerId: 1 });
    expect(lastCall(onPositionChange)).toEqual([
      30,
      expect.objectContaining({ reason: "press" }),
    ]);
    fireEvent.pointerMove(ruler, { clientX: 100, pointerId: 1 });
    expect(lastCall(onPositionChange)[0]).toBe(50);
    expect(position(playhead)).toBe("50");

    fireEvent.pointerUp(ruler, { clientX: 100, pointerId: 1 });
    expect(lastCall(onPositionCommitted)).toEqual([
      50,
      expect.objectContaining({ reason: "drag" }),
    ]);
  });

  test("lands on the grid, unless Cmd or Ctrl is held", () => {
    const { onPositionChange, ruler } = renderTimeline({ snapStep: 4 });
    fireEvent.pointerDown(ruler, { clientX: 61, pointerId: 1 });
    expect(lastCall(onPositionChange)[0]).toBe(32);
    fireEvent.pointerMove(ruler, { clientX: 61, metaKey: true, pointerId: 1 });
    expect(lastCall(onPositionChange)[0]).toBe(30.5);
  });

  test("Shift scrubs four times finer, from where it was held", () => {
    const { onPositionChange, ruler } = renderTimeline();
    fireEvent.pointerDown(ruler, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(ruler, {
      clientX: 140,
      pointerId: 1,
      shiftKey: true,
    });
    // 40px is 20 units at full speed, 5 when fine
    expect(lastCall(onPositionChange)[0]).toBe(55);
  });

  test("is marked while scrubbing", () => {
    const { ruler, view } = renderTimeline();
    fireEvent.pointerDown(ruler, { clientX: 100, pointerId: 1 });
    expect(view.getByTestId("root").hasAttribute("data-scrubbing")).toBe(true);
    fireEvent.pointerUp(ruler, { clientX: 100, pointerId: 1 });
    expect(view.getByTestId("root").hasAttribute("data-scrubbing")).toBe(false);
  });

  test("eventDetails.cancel() keeps the position", () => {
    const { playhead, ruler } = renderTimeline({
      onPositionChange: (_value, details) => details.cancel(),
    });
    fireEvent.pointerDown(ruler, { clientX: 100, pointerId: 1 });
    expect(position(playhead)).toBe("0");
  });

  test("ignores the pointer when disabled", () => {
    const { onPositionChange, ruler } = renderTimeline({ disabled: true });
    fireEvent.pointerDown(ruler, { clientX: 100, pointerId: 1 });
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  test("sets touch-action: none", () => {
    expect(renderTimeline().ruler.style.touchAction).toBe("none");
  });
});

describe("Timeline.Ruler keyboard", () => {
  test("holds a named native range input over the timeline", () => {
    const { input } = renderTimeline({ defaultPosition: 12 });
    expect(input.type).toBe("range");
    expect([input.min, input.max, input.value]).toEqual(["0", "100", "12"]);
    expect(input.getAttribute("aria-label")).toBe("Position");
    expect(input.getAttribute("aria-valuetext")).toBe("12");
  });

  const cases: [string, Partial<KeyboardEventInit>, number][] = [
    ["ArrowRight", {}, 44],
    ["ArrowLeft", {}, 36],
    ["ArrowRight", { shiftKey: true }, 80],
    ["PageDown", {}, 0],
    ["Home", {}, 0],
    ["End", {}, 100],
  ];

  for (const [key, init, expected] of cases) {
    test(`${init.shiftKey ? "Shift+" : ""}${key} from 40, a grid of 4, goes to ${expected}`, () => {
      const { input, onPositionCommitted } = renderTimeline({
        defaultPosition: 40,
        snapStep: 4,
      });
      fireEvent.keyDown(input, { key, ...init });
      expect(lastCall(onPositionCommitted)).toEqual([
        expected,
        expect.objectContaining({ reason: "keyboard" }),
      ]);
    });
  }

  test("announces the position as getAriaValueText says", () => {
    const { input } = renderTimeline({ defaultPosition: 8 });
    expect(input.getAttribute("aria-valuetext")).toBe("8");
  });
});

describe("Timeline.Root position source", () => {
  test("the playhead and the input follow the source without re-rendering React", () => {
    const source = createTestSource(0);
    const { input, playhead } = renderTimeline({ source });
    act(() => source.emit(42.5));
    expect(position(playhead)).toBe("42.5");
    expect(input.value).toBe("42.5");
    expect(input.getAttribute("aria-valuetext")).toBe("42.5");
  });

  test("a scrub wins over the source until release", () => {
    const source = createTestSource(10);
    const { playhead, ruler } = renderTimeline({ source });
    fireEvent.pointerDown(ruler, { clientX: 100, pointerId: 1 });
    act(() => source.emit(11));
    expect(position(playhead)).toBe("50");
    fireEvent.pointerUp(ruler, { clientX: 100, pointerId: 1 });
    expect(position(playhead)).toBe("11");
  });

  test("a controlled position that lags doesn't pull the playhead back mid-scrub", () => {
    const { playhead, ruler } = renderTimeline({ position: 10 });
    fireEvent.pointerDown(ruler, { clientX: 100, pointerId: 1 });
    expect(position(playhead)).toBe("50");
    fireEvent.pointerUp(ruler, { clientX: 100, pointerId: 1 });
    expect(position(playhead)).toBe("10");
  });

  test("keeps the position on the timeline", () => {
    const { playhead } = renderTimeline({ position: 400 });
    expect(position(playhead)).toBe("100");
  });

  test("unsubscribes on unmount", () => {
    const source = createTestSource(0);
    const { view } = renderTimeline({ source });
    expect(source.listenerCount()).toBe(1);
    view.unmount();
    expect(source.listenerCount()).toBe(0);
  });
});

describe("Timeline.Ruler selection (100 units over 200px)", () => {
  const handlers = () => ({
    onSelectionChange: mock(
      (_range: readonly [number, number], _details: unknown) => undefined
    ),
    onSelectionCommitted: mock(
      (_range: readonly [number, number], _details: unknown) => undefined
    ),
  });

  test("Shift + drag selects a stretch, on the grid, without moving the position", () => {
    const { onSelectionChange, onSelectionCommitted } = handlers();
    const { onPositionChange, ruler } = renderTimeline(
      { snapStep: 4 },
      { onSelectionChange, onSelectionCommitted }
    );
    fireEvent.pointerDown(ruler, {
      clientX: 100,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerMove(ruler, { clientX: 41, pointerId: 1 });
    expect(lastCall(onSelectionChange)).toEqual([
      [20, 52],
      expect.objectContaining({ reason: "drag" }),
    ]);
    fireEvent.pointerUp(ruler, { clientX: 41, pointerId: 1 });
    expect(lastCall(onSelectionCommitted)[0]).toEqual([20, 52]);
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  test("a plain press still seeks, and Shift without a handler seeks too", () => {
    const { onSelectionChange } = handlers();
    const withHandler = renderTimeline({}, { onSelectionChange });
    fireEvent.pointerDown(withHandler.ruler, { clientX: 60, pointerId: 1 });
    expect(lastCall(withHandler.onPositionChange)[0]).toBe(30);
    expect(onSelectionChange).not.toHaveBeenCalled();
    withHandler.view.unmount();

    const without = renderTimeline();
    fireEvent.pointerDown(without.ruler, {
      clientX: 60,
      pointerId: 1,
      shiftKey: true,
    });
    expect(lastCall(without.onPositionChange)[0]).toBe(30);
  });

  test("cancel() keeps the selection, and an unmoved press selects nothing", () => {
    const { onSelectionCommitted } = handlers();
    const { ruler } = renderTimeline(
      {},
      {
        onSelectionChange: (_range, details) => details.cancel(),
        onSelectionCommitted,
      }
    );
    fireEvent.pointerDown(ruler, {
      clientX: 100,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerMove(ruler, { clientX: 40, pointerId: 1 });
    fireEvent.pointerUp(ruler, { clientX: 40, pointerId: 1 });
    expect(onSelectionCommitted).not.toHaveBeenCalled();
  });
});
