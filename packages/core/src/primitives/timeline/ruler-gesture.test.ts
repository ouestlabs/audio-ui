import { describe, expect, mock, test } from "bun:test";
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
