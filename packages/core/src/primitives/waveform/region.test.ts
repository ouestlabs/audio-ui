import { describe, expect, mock, test } from "bun:test";
import {
  createWaveformRegionController,
  type WaveformRegionOptions,
} from "./region.js";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<WaveformRegionOptions> = {}) =>
  createWaveformRegionController({
    duration: 10,
    largeStep: 1,
    minLength: 0.5,
    step: 0.1,
    ...options,
  });

describe("Waveform region controller value", () => {
  test("spans the whole timeline by default", () => {
    expect(create().getSnapshot().value).toEqual([0, 10]);
  });

  test("a controlled region is shown as given, and a change only reports itself", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const region = create({ onValueChange, value: [2, 4] });
    region.typeAt("start", 3, new Event("input"));
    expect(region.getSnapshot().value).toEqual([2, 4]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("the region is kept in order and inside the timeline", () => {
    expect(create({ defaultValue: [8, -2] }).getSnapshot().value).toEqual([
      0, 8,
    ]);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const region = create({ value: [1, 2] });
    expect(region.getSnapshot()).toBe(region.getSnapshot());
  });
});

describe("Waveform region controller edges", () => {
  test("an edge keeps its minimum length from the other one", () => {
    const region = create({ defaultValue: [2, 4] });
    region.typeAt("start", 9, new Event("input"));
    expect(region.getSnapshot().value).toEqual([3.5, 4]);
    region.typeAt("end", 0, new Event("input"));
    expect(region.getSnapshot().value).toEqual([3.5, 4]);
  });

  test("the keys move an edge by a step, Shift by a large step, Home and End to its limits", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const region = create({ defaultValue: [2, 4], onValueCommitted });
    expect(region.keyDown("end", key("ArrowRight", { shiftKey: true }))).toBe(
      true
    );
    expect(region.getSnapshot().value[1]).toBe(5);
    region.keyDown("start", key("End"));
    expect(region.getSnapshot().value[0]).toBe(4.5);
    // The end cannot go below the start plus the minimum length: nothing moves.
    region.keyDown("end", key("Home"));
    expect(region.getSnapshot().value).toEqual([4.5, 5]);
    expect(onValueCommitted).toHaveBeenCalledTimes(2);
  });

  test("a key that is not the edge's is left alone, and a disabled region ignores keys", () => {
    expect(create().keyDown("start", key("a"))).toBe(false);
    expect(create({ disabled: true }).keyDown("start", key("ArrowUp"))).toBe(
      false
    );
  });
});

describe("Waveform region controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const region = create({ defaultValue: [2, 4] });
    const listener = mock(() => undefined);
    const unsubscribe = region.subscribe(listener);
    region.keyDown("end", key("ArrowUp"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    region.keyDown("end", key("ArrowUp"));
    expect(listener).not.toHaveBeenCalled();
  });
});
