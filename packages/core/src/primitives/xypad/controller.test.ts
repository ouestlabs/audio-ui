import { describe, expect, mock, test } from "bun:test";
import { createXYPadController } from "./controller.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

describe("XY pad controller value", () => {
  test("holds the center of the pad when uncontrolled", () => {
    const pad = createXYPadController({ maxX: 10, maxY: 20 });
    expect(pad.getSnapshot().value).toEqual({ x: 5, y: 10 });
  });

  test("each axis is clamped and snapped to its own step", () => {
    const pad = createXYPadController({
      maxX: 10,
      maxY: 10,
      stepX: 0.5,
      stepY: 2,
    });
    pad.type("x", 4.3, new Event("input"));
    pad.type("y", 3.1, new Event("input"));
    expect(pad.getSnapshot().value).toEqual({ x: 4.5, y: 4 });
    pad.type("x", 99, new Event("input"));
    expect(pad.getSnapshot().value.x).toBe(10);
  });

  test("a controlled point is shown as given and only the change tells the caller", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const pad = createXYPadController({
      onValueChange,
      value: { x: 20, y: 30 },
    });
    pad.type("x", 50, new Event("input"));
    expect(pad.getSnapshot().value).toEqual({ x: 20, y: 30 });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const pad = createXYPadController({ value: { x: 1, y: 2 } });
    expect(pad.getSnapshot()).toBe(pad.getSnapshot());
  });

  test("the position is a share of each axis, and the pair is formatted together", () => {
    const pad = createXYPadController({
      locale: "en-US",
      maxX: 100,
      maxY: 50,
      value: { x: 25, y: 50 },
    });
    const snapshot = pad.getSnapshot();
    expect(snapshot.percentX).toBe(0.25);
    expect(snapshot.percentY).toBe(1);
    expect(snapshot.formattedPair).toBe("25, 50");
  });
});

describe("XY pad controller keys", () => {
  test("arrows move one step, Shift ten, and report a keyboard change committed at once", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const pad = createXYPadController({
      defaultValue: { x: 10, y: 10 },
      onValueCommitted,
    });
    expect(pad.keyDown(key("ArrowRight"))).toBe(true);
    expect(pad.getSnapshot().value).toEqual({ x: 11, y: 10 });
    pad.keyDown(key("ArrowUp", { shiftKey: true }));
    expect(pad.getSnapshot().value).toEqual({ x: 11, y: 20 });
    expect(onValueCommitted).toHaveBeenCalledTimes(2);
  });

  test("Home and End move x to its ends, and a key that is not the pad's is left alone", () => {
    const pad = createXYPadController({
      defaultValue: { x: 10, y: 10 },
      maxX: 50,
    });
    pad.keyDown(key("End"));
    expect(pad.getSnapshot().value.x).toBe(50);
    pad.keyDown(key("Home"));
    expect(pad.getSnapshot().value.x).toBe(0);
    expect(pad.keyDown(key("a"))).toBe(false);
  });

  test("Delete resets both axes to the default point", () => {
    const pad = createXYPadController({ defaultValue: { x: 5, y: 5 } });
    pad.type("x", 80, new Event("input"));
    pad.type("y", 90, new Event("input"));
    expect(pad.keyDown(key("Delete"))).toBe(true);
    expect(pad.getSnapshot().value).toEqual({ x: 5, y: 5 });
  });

  test("a disabled pad ignores keys", () => {
    const pad = createXYPadController({ disabled: true });
    expect(pad.keyDown(key("ArrowUp"))).toBe(false);
  });
});

describe("XY pad controller reset and wheel", () => {
  test("reset returns to the default point and commits with a reset reason", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const pad = createXYPadController({
      defaultValue: { x: 1, y: 2 },
      onValueCommitted,
      value: { x: 9, y: 9 },
    });
    pad.reset(new MouseEvent("dblclick"));
    expect(onValueCommitted.mock.calls[0]?.[0]).toEqual({ x: 1, y: 2 });
  });

  test("a wheel scroll moves the point, clamped to the pad", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const pad = createXYPadController({
      defaultValue: { x: 50, y: 50 },
      onValueChange,
    });
    const element = document.createElement("div");
    const detach = pad.attachWheel(element);
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(pad.getSnapshot().value.y).toBe(100);
    detach();
  });
});

describe("XY pad controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const pad = createXYPadController();
    const listener = mock(() => undefined);
    const unsubscribe = pad.subscribe(listener);
    pad.keyDown(key("ArrowUp"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    pad.keyDown(key("ArrowUp"));
    expect(listener).not.toHaveBeenCalled();
  });
});
