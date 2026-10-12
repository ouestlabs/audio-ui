import { describe, expect, mock, test } from "bun:test";
import {
  createTrackController,
  type TrackOptions,
} from "./track-controller.js";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<TrackOptions> = {}) =>
  createTrackController({
    largeStep: 32,
    max: 200,
    measure: () => 100,
    min: 32,
    step: 8,
    ...options,
  });

describe("Track height", () => {
  test("arrows move the height by a step, Page keys by a large one, Home and End to the limits", () => {
    const onHeightCommitted = mock(
      (_height: unknown, _details: unknown) => undefined
    );
    const track = create({
      height: 100,
      onHeightCommitted,
      onHeightChange: () => undefined,
    });
    expect(track.keyDown(key("ArrowDown"))).toBe(true);
    expect(onHeightCommitted.mock.calls[0]?.[0]).toBe(108);
    expect(track.keyDown(key("PageUp"))).toBe(true);
    expect(onHeightCommitted.mock.calls[1]?.[0]).toBe(68);
    track.keyDown(key("End"));
    expect(onHeightCommitted.mock.calls[2]?.[0]).toBe(200);
  });

  test("a height that is refused is not committed", () => {
    const onHeightCommitted = mock(
      (_height: unknown, _details: unknown) => undefined
    );
    const track = create({
      height: 100,
      onHeightChange: (_height, details) => details.cancel(),
      onHeightCommitted,
    });
    track.keyDown(key("ArrowDown"));
    expect(onHeightCommitted).not.toHaveBeenCalled();
  });

  test("a height the track already has is not asked for again", () => {
    const onHeightChange = mock(
      (_height: unknown, _details: unknown) => undefined
    );
    const track = create({ height: 200, onHeightChange });
    expect(track.keyDown(key("End"))).toBe(true);
    expect(onHeightChange).not.toHaveBeenCalled();
  });

  test("a row without a height measures what it is drawn at", () => {
    const onHeightChange = mock(
      (_height: unknown, _details: unknown) => undefined
    );
    const track = create({ onHeightChange });
    track.keyDown(key("ArrowUp"));
    expect(onHeightChange.mock.calls[0]?.[0]).toBe(92);
  });

  test("a double click gives the height up, which is undefined", () => {
    const onHeightCommitted = mock(
      (_height: unknown, _details: unknown) => undefined
    );
    const track = create({
      height: 100,
      onHeightChange: () => undefined,
      onHeightCommitted,
    });
    track.reset(new MouseEvent("dblclick"));
    expect(onHeightCommitted.mock.calls[0]?.[0]).toBeUndefined();
  });

  test("an input sets the height and commits it, and a key that is not the handle's is left alone", () => {
    const onHeightCommitted = mock(
      (_height: unknown, _details: unknown) => undefined
    );
    const track = create({
      height: 100,
      onHeightChange: () => undefined,
      onHeightCommitted,
    });
    track.typeAt(150, new Event("input"));
    expect(onHeightCommitted.mock.calls[0]?.[0]).toBe(150);
    expect(track.keyDown(key("a"))).toBe(false);
  });
});
