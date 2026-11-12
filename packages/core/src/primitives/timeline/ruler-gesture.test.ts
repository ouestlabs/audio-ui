import { describe, expect, mock, test } from "bun:test";
import {
  boxElement,
  dragWithSecondFinger,
  ONE_FINGER,
} from "../../../test/helpers.ts";
import { createTimelineController, type TimelineOptions } from "./position.ts";

const create = (options: Partial<TimelineOptions> = {}) =>
  createTimelineController({
    duration: 100,
    grid: { offset: 0, step: 0 },
    largeStep: 10,
    maxZoom: Number.POSITIVE_INFINITY,
    minZoom: 0,
    step: 1,
    zoom: 10,
    ...options,
  });

// A pointer event as the ruler reads it: its position, its keys and its button.
const pointer = (
  type: string,
  init: {
    clientX: number;
    shiftKey?: boolean;
    buttons?: number;
    pointerId?: number;
  }
) =>
  Object.assign(new Event(type), {
    altKey: false,
    button: 0,
    buttons: init.buttons ?? 1,
    clientX: init.clientX,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    pointerId: init.pointerId ?? 1,
    pointerType: "mouse",
    shiftKey: init.shiftKey ?? false,
  }) as unknown as PointerEvent;

const handle = document.createElement("div");

describe("Timeline ruler press", () => {
  test("a press seeks to the pointer, and a release commits the drag", () => {
    const onPositionChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const onPositionCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const timeline = create({ onPositionChange, onPositionCommitted });
    timeline.pressRuler(
      pointer("pointerdown", { clientX: 50 }),
      handle,
      handle
    );
    expect(onPositionChange.mock.calls[0]?.[0]).toBe(5);
    document.dispatchEvent(pointer("pointermove", { clientX: 80 }));
    expect(timeline.getSnapshot().position).toBe(8);
    document.dispatchEvent(pointer("pointerup", { clientX: 80, buttons: 0 }));
    expect(onPositionCommitted.mock.calls[0]?.[0]).toBe(8);
  });

  test("Shift scrubs four times finer than the pointer moves", () => {
    const timeline = create({ defaultPosition: 0 });
    timeline.pressRuler(pointer("pointerdown", { clientX: 0 }), handle, handle);
    document.dispatchEvent(
      pointer("pointermove", { clientX: 100, shiftKey: true })
    );
    expect(timeline.getSnapshot().position).toBeCloseTo(10 * 0.25, 10);
    document.dispatchEvent(
      pointer("pointerup", { clientX: 100, buttons: 0, shiftKey: true })
    );
  });

  test("with a selection listener, Shift + drag selects a stretch and leaves the position", () => {
    const onSelectionCommitted = mock(
      (_range: unknown, _details: unknown) => undefined
    );
    const timeline = create({ defaultPosition: 0 });
    timeline.setSelection({
      onSelectionChange: () => undefined,
      onSelectionCommitted,
    });
    timeline.pressRuler(
      pointer("pointerdown", { clientX: 60, shiftKey: true }),
      handle,
      handle
    );
    document.dispatchEvent(
      pointer("pointermove", { clientX: 20, shiftKey: true })
    );
    document.dispatchEvent(
      pointer("pointerup", { clientX: 20, buttons: 0, shiftKey: true })
    );
    expect(onSelectionCommitted.mock.calls[0]?.[0]).toEqual([2, 6]);
    expect(timeline.getSnapshot().position).toBe(0);
  });
});

describe("Timeline ruler input", () => {
  test("an input seeks and commits as an input change", () => {
    const onPositionCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const timeline = create({ onPositionCommitted });
    timeline.typeAt(42, new Event("input"));
    expect(onPositionCommitted.mock.calls[0]?.[0]).toBe(42);
  });
});

describe("Timeline lane press with a selection", () => {
  test("a drag selects from the press to the pointer, and the position stays at the press", () => {
    const onSelectionChange = mock(
      (_range: unknown, _details: unknown) => undefined
    );
    const onSelectionCommitted = mock(
      (_range: unknown, _details: unknown) => undefined
    );
    const timeline = create();
    timeline.pressSeek(
      pointer("pointerdown", { clientX: 50 }),
      handle,
      handle,
      {
        onSelectionChange,
        onSelectionCommitted,
      }
    );
    expect(timeline.getSnapshot().position).toBe(5);
    document.dispatchEvent(pointer("pointermove", { clientX: 20 }));
    expect(onSelectionChange.mock.calls[0]?.[0]).toEqual([2, 5]);
    expect(timeline.getSnapshot().position).toBe(5);
    document.dispatchEvent(pointer("pointerup", { clientX: 20, buttons: 0 }));
    expect(onSelectionCommitted.mock.calls[0]?.[0]).toEqual([2, 5]);
  });

  test("a press that does not move selects nothing", () => {
    const onSelectionCommitted = mock(
      (_range: unknown, _details: unknown) => undefined
    );
    const timeline = create();
    timeline.pressSeek(
      pointer("pointerdown", { clientX: 50 }),
      handle,
      handle,
      {
        onSelectionChange: () => undefined,
        onSelectionCommitted,
      }
    );
    document.dispatchEvent(pointer("pointerup", { clientX: 50, buttons: 0 }));
    expect(onSelectionCommitted).not.toHaveBeenCalled();
    expect(timeline.getSnapshot().position).toBe(5);
  });
});

describe("Timeline snap points under a press", () => {
  // 10 px a unit: the points pull from 8 px, 0.8 units, away.
  const grid = { offset: 0, points: [3, 7.5], step: 0 };

  test("a press on the lane lands on a point within reach, and a drag's end does too", () => {
    const onSelectionChange = mock(
      (_range: unknown, _details: unknown) => undefined
    );
    const timeline = create({ grid });
    timeline.pressSeek(
      pointer("pointerdown", { clientX: 35 }),
      handle,
      handle,
      { onSelectionChange, onSelectionCommitted: () => undefined }
    );
    expect(timeline.getSnapshot().position).toBe(3);
    document.dispatchEvent(pointer("pointermove", { clientX: 69 }));
    expect(onSelectionChange.mock.calls.at(-1)?.[0]).toEqual([3, 7.5]);
    document.dispatchEvent(pointer("pointerup", { clientX: 69, buttons: 0 }));
  });

  test("a point out of reach leaves the press where it is, and so does Cmd or Ctrl", () => {
    const timeline = create({ grid });
    timeline.pressSeek(pointer("pointerdown", { clientX: 50 }), handle, handle);
    expect(timeline.getSnapshot().position).toBe(5);
    document.dispatchEvent(pointer("pointerup", { clientX: 50, buttons: 0 }));
    const held = create({ grid });
    held.pressSeek(
      Object.assign(pointer("pointerdown", { clientX: 35 }), { metaKey: true }),
      handle,
      handle
    );
    expect(held.getSnapshot().position).toBe(3.5);
    document.dispatchEvent(pointer("pointerup", { clientX: 35, buttons: 0 }));
  });

  test("a press on the ruler lands on a point within reach", () => {
    const timeline = create({ grid });
    timeline.pressRuler(
      pointer("pointerdown", { clientX: 73 }),
      handle,
      handle
    );
    expect(timeline.getSnapshot().position).toBe(7.5);
    document.dispatchEvent(pointer("pointerup", { clientX: 73, buttons: 0 }));
  });
});

describe("Timeline pointers", () => {
  test("a second finger on the ruler is ignored, and the first goes on seeking", () => {
    const onPositionChange = mock(() => undefined);
    const onPositionCommitted = mock(() => undefined);
    // 10px a unit.
    const timeline = create({ onPositionChange, onPositionCommitted });
    const ruler = boxElement(1000, 20);
    const result = dragWithSecondFinger({
      changes: () => onPositionChange.mock.calls.length,
      commits: () => onPositionCommitted.mock.calls.length,
      first: [
        [50, 10],
        [100, 10],
        [150, 10],
      ],
      press: (event) => timeline.pressRuler(event, ruler, ruler),
      second: [
        [500, 10],
        [600, 10],
      ],
    });
    expect(result).toEqual(ONE_FINGER);
  });
});
