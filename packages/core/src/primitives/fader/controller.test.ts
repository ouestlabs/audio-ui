import { describe, expect, mock, test } from "bun:test";
import { createFaderController } from "./controller";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

describe("Fader controller value", () => {
  test("holds the midpoint of the range when uncontrolled", () => {
    const fader = createFaderController();
    expect(fader.getSnapshot().value).toBe(-27);
  });

  test("a controlled value is shown as given and only the change tells the caller", () => {
    const onValueChange = mock(
      (_value: number, _details: unknown) => undefined
    );
    const fader = createFaderController({ onValueChange, value: -6 });
    fader.type(-3, new Event("input"));
    expect(fader.getSnapshot().value).toBe(-6);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const fader = createFaderController({ value: -6 });
    expect(fader.getSnapshot()).toBe(fader.getSnapshot());
  });

  test("formats the value with the given options", () => {
    const fader = createFaderController({
      format: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
      locale: "en-US",
      value: -6,
    });
    expect(fader.getSnapshot().formatted).toBe("-6.0");
  });

  test("the fill runs from the anchor to the value", () => {
    const fader = createFaderController({
      anchor: 0,
      min: -60,
      max: 6,
      value: -6,
    });
    const { fill } = fader.getSnapshot();
    expect(fill.from).toBeCloseTo((54 / 66) * 100, 5);
    expect(fill.to).toBeCloseTo((60 / 66) * 100, 5);
  });
});

describe("Fader controller keys", () => {
  test("arrows move by one step and report a keyboard change, committed at once", () => {
    const onValueChange = mock(
      (_value: number, _details: unknown) => undefined
    );
    const onValueCommitted = mock(
      (_value: number, _details: unknown) => undefined
    );
    const fader = createFaderController({ onValueChange, onValueCommitted });
    const handled = fader.keyDown(key("ArrowUp"), document.body);
    expect(handled).toBe(true);
    expect(fader.getSnapshot().value).toBe(-26);
    const [value, details] = onValueChange.mock.calls[0] as unknown as [
      number,
      { reason: string },
    ];
    expect(value).toBe(-26);
    expect(details.reason).toBe("keyboard");
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  test("Shift, Page, Home and End use the large step or the ends", () => {
    const fader = createFaderController({ largeStep: 5 });
    fader.keyDown(key("PageUp"), document.body);
    expect(fader.getSnapshot().value).toBe(-22);
    fader.keyDown(key("ArrowDown", { shiftKey: true }), document.body);
    expect(fader.getSnapshot().value).toBe(-27);
    fader.keyDown(key("End"), document.body);
    expect(fader.getSnapshot().value).toBe(6);
    fader.keyDown(key("Home"), document.body);
    expect(fader.getSnapshot().value).toBe(-60);
  });

  test("a key that is not the fader's is left alone", () => {
    const fader = createFaderController();
    expect(fader.keyDown(key("a"), document.body)).toBe(false);
  });

  test("a disabled fader ignores keys", () => {
    const fader = createFaderController({ disabled: true });
    expect(fader.keyDown(key("ArrowUp"), document.body)).toBe(false);
    expect(fader.getSnapshot().value).toBe(-27);
  });

  test("a canceled change keeps the value", () => {
    const fader = createFaderController({
      onValueChange: (_value, details) => details.cancel(),
    });
    fader.keyDown(key("ArrowUp"), document.body);
    expect(fader.getSnapshot().value).toBe(-27);
  });
});

describe("Fader controller reset and typed values", () => {
  test("reset returns to the default and commits with a reset reason", () => {
    const onValueCommitted = mock(
      (_value: number, _details: unknown) => undefined
    );
    const fader = createFaderController({
      defaultValue: -6,
      onValueCommitted,
      value: -20,
    });
    fader.reset(new MouseEvent("dblclick"));
    expect(onValueCommitted.mock.calls[0]?.[0]).toBe(-6);
  });

  test("a typed value is clamped and snapped to the step", () => {
    const fader = createFaderController({
      max: 6,
      min: -60,
      step: 0.5,
      defaultValue: -6,
    });
    fader.type(100, new Event("input"));
    expect(fader.getSnapshot().value).toBe(6);
    fader.type(-6.3, new Event("input"));
    expect(fader.getSnapshot().value).toBe(-6.5);
  });
});

describe("Fader controller wheel", () => {
  test("a wheel step moves one step up or down, and small deltas are ignored", () => {
    const onValueChange = mock(
      (_value: number, _details: unknown) => undefined
    );
    const fader = createFaderController({ onValueChange, value: -6 });
    const element = document.createElement("div");
    const detach = fader.attachWheel(element);
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
    expect(onValueChange.mock.calls[0]?.[0]).toBe(-5);
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 0.01 }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    detach();
  });
});

describe("Fader controller subscriptions", () => {
  test("subscribers hear every change of what is shown, and stop when they unsubscribe", () => {
    const fader = createFaderController();
    const listener = mock(() => undefined);
    const unsubscribe = fader.subscribe(listener);
    fader.keyDown(key("ArrowUp"), document.body);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    fader.keyDown(key("ArrowUp"), document.body);
    expect(listener).not.toHaveBeenCalled();
  });
});
