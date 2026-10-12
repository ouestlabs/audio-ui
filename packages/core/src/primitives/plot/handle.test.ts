import { describe, expect, mock, test } from "bun:test";
import { LINEAR_SCALE } from "../../value/scale.ts";
import {
  createPlotHandleController,
  type PlotHandleOptions,
} from "./handle.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const LINEAR = { max: 100, min: 0, scale: LINEAR_SCALE };

const create = (options: Partial<PlotHandleOptions> = {}) =>
  createPlotHandleController({
    measure: () => null,
    x: LINEAR,
    y: LINEAR,
    ...options,
  });

describe("Plot handle controller value", () => {
  test("starts in the middle of the plot when uncontrolled", () => {
    const handle = create();
    expect(handle.getSnapshot().value).toEqual({ x: 50, y: 50 });
    expect(handle.getSnapshot().position).toEqual({ x: 0.5, y: 0.5 });
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const handle = create({ value: { x: 10, y: 20 } });
    expect(handle.getSnapshot()).toBe(handle.getSnapshot());
  });

  test("a controlled value is shown as given, and a change only reports itself", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const handle = create({ onValueChange, value: { x: 10, y: 20 } });
    handle.keyDown(key("ArrowRight"));
    expect(handle.getSnapshot().value).toEqual({ x: 10, y: 20 });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("the value is clamped to the axes", () => {
    const handle = create({ defaultValue: { x: 500, y: -5 } });
    expect(handle.getSnapshot().value).toEqual({ x: 100, y: 0 });
  });
});

describe("Plot handle controller keys and axes", () => {
  test("arrows move a hundredth of the axis, Shift a tenth, committed at once", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const handle = create({ defaultValue: { x: 0, y: 0 }, onValueCommitted });
    expect(handle.keyDown(key("ArrowRight"))).toBe(true);
    expect(handle.getSnapshot().value.x).toBeCloseTo(1, 10);
    handle.keyDown(key("ArrowUp", { shiftKey: true }));
    expect(handle.getSnapshot().value.y).toBeCloseTo(10, 10);
    expect(onValueCommitted).toHaveBeenCalledTimes(2);
  });

  test("a handle on one axis leaves the other where it is", () => {
    const handle = create({ axis: "x", defaultValue: { x: 0, y: 30 } });
    handle.keyDown(key("ArrowUp"));
    expect(handle.getSnapshot().value.y).toBe(30);
    handle.keyDown(key("ArrowRight"));
    expect(handle.getSnapshot().value.x).toBeCloseTo(1, 10);
  });

  test("Home and End go to the ends of the axis the handle moves along", () => {
    const handle = create({ defaultValue: { x: 50, y: 50 } });
    handle.keyDown(key("End"));
    expect(handle.getSnapshot().value).toEqual({ x: 100, y: 50 });
    handle.keyDown(key("Home"));
    expect(handle.getSnapshot().value).toEqual({ x: 0, y: 50 });
  });

  test("a key that is not the handle's is left alone, and a disabled handle ignores keys", () => {
    expect(create().keyDown(key("a"))).toBe(false);
    expect(create({ disabled: true }).keyDown(key("ArrowUp"))).toBe(false);
  });
});

describe("Plot handle controller reset and inputs", () => {
  test("Delete returns the handle to its default value and commits it", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const handle = create({ defaultValue: { x: 25, y: 75 }, onValueCommitted });
    handle.keyDown(key("ArrowRight"));
    expect(handle.keyDown(key("Delete"))).toBe(true);
    expect(handle.getSnapshot().value).toEqual({ x: 25, y: 75 });
    expect(onValueCommitted.mock.calls.at(-1)?.[0]).toEqual({ x: 25, y: 75 });
  });

  test("an input moves one axis to a position, 0…1", () => {
    const handle = create({ defaultValue: { x: 0, y: 0 } });
    handle.typeAt("y", 0.25, new Event("input"));
    expect(handle.getSnapshot().value).toEqual({ x: 0, y: 25 });
  });
});

describe("Plot handle controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const handle = create();
    const listener = mock(() => undefined);
    const unsubscribe = handle.subscribe(listener);
    handle.keyDown(key("ArrowUp"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    handle.keyDown(key("ArrowUp"));
    expect(listener).not.toHaveBeenCalled();
  });
});
