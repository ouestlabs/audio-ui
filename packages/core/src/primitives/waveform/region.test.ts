import { describe, expect, mock, test } from "bun:test";
import {
  boxElement,
  dragWithSecondFinger,
  ONE_FINGER,
} from "../../../test/helpers.ts";
import {
  createWaveformRegionController,
  type WaveformRegionOptions,
} from "./region.ts";

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

describe("Waveform region controller pointers", () => {
  test("a second finger on the other edge is ignored, and the first goes on moving its edge", () => {
    const onValueChange = mock(() => undefined);
    const onValueCommitted = mock(() => undefined);
    const region = create({ onValueChange, onValueCommitted });
    // 100px for the 10 units shown: 0.1 a pixel.
    const track = boxElement(100, 20);
    let edge: "end" | "start" = "start";
    const result = dragWithSecondFinger({
      changes: () => onValueChange.mock.calls.length,
      commits: () => onValueCommitted.mock.calls.length,
      first: [
        [0, 10],
        [20, 10],
        [40, 10],
      ],
      press: (event) => {
        region.press(edge, event, track, track, [0, 10]);
        edge = "end";
      },
      second: [
        [100, 10],
        [80, 10],
      ],
    });
    expect(result).toEqual(ONE_FINGER);
  });
});
