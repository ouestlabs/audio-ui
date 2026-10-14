import { describe, expect, mock, test } from "bun:test";
import { createKnobController } from "./controller.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

describe("Knob controller value", () => {
  test("holds the middle of the travel when uncontrolled", () => {
    const knob = createKnobController({ max: 10, min: 0 });
    expect(knob.getSnapshot().value).toBe(5);
  });

  test("a controlled value is shown as given and only the change tells the caller", () => {
    const onValueChange = mock(
      (_value: number, _details: unknown) => undefined
    );
    const knob = createKnobController({ onValueChange, value: 20 });
    knob.type(30, new Event("input"));
    expect(knob.getSnapshot().value).toBe(20);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("the scale it is created with applies at once, before any setOptions", () => {
    const knob = createKnobController({ max: 20_000, min: 20, scale: "log" });
    // The middle of a logarithmic 20 Hz to 20 kHz travel is about 632 Hz.
    expect(knob.getSnapshot().value).toBe(632);
    expect(knob.getSnapshot().percent).toBeCloseTo(0.5, 2);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const knob = createKnobController({ value: 20 });
    expect(knob.getSnapshot()).toBe(knob.getSnapshot());
  });

  test("the arc starts at the anchor and the angle follows the value", () => {
    const knob = createKnobController({
      anchor: 0,
      max: 100,
      min: 0,
      value: 100,
    });
    const snapshot = knob.getSnapshot();
    expect(snapshot.anchorPercent).toBe(0);
    expect(snapshot.percent).toBe(1);
  });
});

describe("Knob controller keys", () => {
  test("arrows move by one step and report a keyboard change, committed at once", () => {
    const onValueChange = mock(
      (_value: number, _details: unknown) => undefined
    );
    const onValueCommitted = mock(
      (_value: number, _details: unknown) => undefined
    );
    const knob = createKnobController({
      defaultValue: 20,
      onValueChange,
      onValueCommitted,
    });
    expect(knob.keyDown(key("ArrowUp"))).toBe(true);
    expect(knob.getSnapshot().value).toBe(21);
    const [value, details] = onValueChange.mock.calls[0] as unknown as [
      number,
      { reason: string },
    ];
    expect(value).toBe(21);
    expect(details.reason).toBe("keyboard");
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  test("Page keys move by the large step, Home and End go to the ends", () => {
    const knob = createKnobController({ defaultValue: 50, largeStep: 5 });
    knob.keyDown(key("PageUp"));
    expect(knob.getSnapshot().value).toBe(55);
    knob.keyDown(key("End"));
    expect(knob.getSnapshot().value).toBe(100);
    knob.keyDown(key("Home"));
    expect(knob.getSnapshot().value).toBe(0);
  });

  test("Delete resets to the default value", () => {
    const knob = createKnobController({ defaultValue: 30, value: 80 });
    expect(knob.keyDown(key("Delete"))).toBe(true);
    expect(knob.getSnapshot().resetValue).toBe(30);
  });

  test("a key that is not the knob's is left alone, and a disabled knob ignores keys", () => {
    expect(createKnobController().keyDown(key("a"))).toBe(false);
    const disabled = createKnobController({ disabled: true });
    expect(disabled.keyDown(key("ArrowUp"))).toBe(false);
  });
});

describe("Knob controller reset and typed values", () => {
  test("reset returns to the default and commits with a reset reason", () => {
    const onValueCommitted = mock(
      (_value: number, _details: unknown) => undefined
    );
    const knob = createKnobController({
      defaultValue: 40,
      onValueCommitted,
      value: 90,
    });
    knob.reset(new KeyboardEvent("keydown", { key: "Delete" }));
    expect(onValueCommitted.mock.calls[0]?.[0]).toBe(40);
  });

  test("a typed value is clamped and snapped to the step", () => {
    const knob = createKnobController({ max: 10, min: 0, step: 0.5 });
    knob.type(42, new Event("input"));
    expect(knob.getSnapshot().value).toBe(10);
    knob.type(-3, new Event("input"));
    expect(knob.getSnapshot().value).toBe(0);
  });
});

describe("Knob controller wheel", () => {
  test("a wheel step moves one step up or down, and small deltas are ignored", () => {
    const onValueChange = mock(
      (_value: number, _details: unknown) => undefined
    );
    const knob = createKnobController({ defaultValue: 50, onValueChange });
    const element = document.createElement("div");
    const detach = knob.attachWheel(element);
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
    expect(onValueChange.mock.calls[0]?.[0]).toBe(51);
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 0.01 }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    detach();
  });
});

describe("Knob controller subscriptions", () => {
  test("subscribers hear every change of what is shown, and stop when they unsubscribe", () => {
    const knob = createKnobController();
    const listener = mock(() => undefined);
    const unsubscribe = knob.subscribe(listener);
    knob.keyDown(key("ArrowUp"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    knob.keyDown(key("ArrowUp"));
    expect(listener).not.toHaveBeenCalled();
  });
});
