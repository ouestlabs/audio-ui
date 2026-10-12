import { describe, expect, mock, test } from "bun:test";
import {
  createRangeController,
  type RangeOptions,
} from "./range-controller.js";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<RangeOptions> = {}) =>
  createRangeController({
    duration: 100,
    grid: { offset: 0, step: 0 },
    largeStep: 10,
    minLength: 2,
    movable: true,
    step: 1,
    zoom: null,
    defaultValue: [20, 40],
    ...options,
  });

describe("Range controller value", () => {
  test("starts at its default range, kept in order and on the timeline", () => {
    expect(create().getSnapshot().value).toEqual([20, 40]);
    expect(create({ defaultValue: [90, -5] }).getSnapshot().value).toEqual([
      0, 90,
    ]);
    expect(create({ defaultValue: undefined }).getSnapshot().value).toEqual([
      0, 100,
    ]);
  });

  test("a controlled range is shown as given, and a change only reports itself", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const range = create({ onValueChange, value: [10, 30] });
    range.moveTypeAt(50, new Event("input"));
    expect(range.getSnapshot().value).toEqual([10, 30]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const range = create();
    expect(range.getSnapshot()).toBe(range.getSnapshot());
  });
});

describe("Range controller body and keys", () => {
  test("arrows move the whole range by a step, keeping its length", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const range = create({ onValueCommitted });
    expect(range.keyDown(key("ArrowRight"))).toBe(true);
    expect(range.getSnapshot().value).toEqual([21, 41]);
    range.keyDown(key("PageUp"));
    expect(range.getSnapshot().value).toEqual([31, 51]);
    expect(onValueCommitted).toHaveBeenCalledTimes(2);
  });

  test("Home and End stop the range at the ends of the timeline", () => {
    const range = create();
    range.keyDown(key("End"));
    expect(range.getSnapshot().value).toEqual([80, 100]);
    range.keyDown(key("Home"));
    expect(range.getSnapshot().value).toEqual([0, 20]);
  });

  test("an input moves the range, clamped to the timeline", () => {
    const range = create();
    range.moveTypeAt(95, new Event("input"));
    expect(range.getSnapshot().value).toEqual([80, 100]);
  });

  test("a key that is not the range's is left alone, and a disabled range ignores keys", () => {
    expect(create().keyDown(key("a"))).toBe(false);
    expect(create({ disabled: true }).keyDown(key("ArrowRight"))).toBe(false);
  });
});

describe("Range controller edges", () => {
  test("an edge keeps its minimum length from the other, and stays on the timeline", () => {
    const range = create();
    expect(range.edgeRange("start")).toEqual([0, 38]);
    expect(range.edgeRange("end")).toEqual([22, 100]);
    range.edgeTypeAt("start", 39, new Event("input"));
    expect(range.getSnapshot().value).toEqual([38, 40]);
  });

  test("the keys move an edge, and Home and End go to its limits", () => {
    const range = create();
    expect(range.edgeKeyDown("end", key("End"))).toBe(true);
    expect(range.getSnapshot().value).toEqual([20, 100]);
    expect(range.edgeKeyDown("start", key("Home"))).toBe(true);
    expect(range.getSnapshot().value).toEqual([0, 100]);
  });
});

describe("Range controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const range = create();
    const listener = mock(() => undefined);
    const unsubscribe = range.subscribe(listener);
    range.keyDown(key("ArrowRight"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    range.keyDown(key("ArrowRight"));
    expect(listener).not.toHaveBeenCalled();
  });
});
