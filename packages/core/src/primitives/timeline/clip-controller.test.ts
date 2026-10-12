import { describe, expect, mock, test } from "bun:test";
import { type ClipOptions, createClipController } from "./clip-controller.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<ClipOptions> = {}) =>
  createClipController({
    duration: 100,
    grid: { offset: 0, step: 0 },
    largeStep: 10,
    minLength: 1,
    movable: true,
    step: 1,
    zoom: null,
    defaultValue: { fadeIn: 0, fadeOut: 0, length: 20, offset: 0, start: 10 },
    ...options,
  });

describe("Clip controller value", () => {
  test("starts with the default clip, and a controlled clip is shown as given", () => {
    expect(create().getSnapshot().value.start).toBe(10);
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const clip = create({
      onValueChange,
      value: { fadeIn: 0, fadeOut: 0, length: 20, offset: 0, start: 30 },
    });
    clip.moveTypeAt(50, new Event("input"));
    expect(clip.getSnapshot().value.start).toBe(30);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("a clip stays on the timeline and its fades within its length", () => {
    const clip = create({
      defaultValue: {
        fadeIn: 50,
        fadeOut: 50,
        length: 500,
        offset: -3,
        start: 200,
      },
    });
    const { value } = clip.getSnapshot();
    expect(value.start + value.length).toBeLessThanOrEqual(100);
    expect(value.fadeIn + value.fadeOut).toBeLessThanOrEqual(value.length);
    expect(value.offset).toBe(0);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const clip = create();
    expect(clip.getSnapshot()).toBe(clip.getSnapshot());
  });
});

describe("Clip controller keys", () => {
  test("arrows move the clip by a step, Shift by a large step, and it stays on the timeline", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const clip = create({ onValueCommitted });
    expect(clip.keyDown(key("ArrowRight"))).toBe(true);
    expect(clip.getSnapshot().value.start).toBe(11);
    clip.keyDown(key("PageDown"));
    expect(clip.getSnapshot().value.start).toBe(1);
    clip.keyDown(key("End"));
    expect(clip.getSnapshot().value.start).toBe(80);
    expect(onValueCommitted).toHaveBeenCalledTimes(3);
  });

  test("Delete calls onRemove, and a key that is not the clip's is left alone", () => {
    const onRemove = mock((_event: KeyboardEvent) => undefined);
    const clip = create({ onRemove });
    expect(clip.keyDown(key("Delete"))).toBe(true);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(clip.keyDown(key("a"))).toBe(false);
  });

  test("a clip that cannot move ignores the move keys, and a disabled one ignores everything", () => {
    expect(create({ movable: false }).keyDown(key("ArrowRight"))).toBe(false);
    expect(create({ disabled: true }).keyDown(key("ArrowRight"))).toBe(false);
  });
});

describe("Clip controller edges and fades", () => {
  test("a trim edge can move only as far as the source and the timeline let it", () => {
    // The clip starts at 10 on a source it begins at 0 of: it can grow back to
    // there, and shrink to its minimum length; its end can run to the source's end.
    const clip = create({ sourceLength: 30 });
    expect(clip.edgeRange("trim-start")).toEqual([10, 29]);
    expect(clip.edgeRange("trim-end")).toEqual([11, 40]);
  });

  test("a fade is bounded by the other fade, and a fade key moves it", () => {
    const clip = create({
      defaultValue: {
        fadeIn: 0,
        fadeOut: 15,
        length: 20,
        offset: 0,
        start: 10,
      },
    });
    expect(clip.edgeRange("fade-in" as never)).toEqual([0, 5]);
    expect(clip.edgeKeyDown("fade-in", key("End"))).toBe(true);
    expect(clip.getSnapshot().value.fadeIn).toBe(5);
  });

  test("a fade shape cycles through its shapes", () => {
    const clip = create();
    const before = clip.getSnapshot().value.fadeInShape;
    clip.cycleFadeShape("in", "double-click", new MouseEvent("dblclick"));
    expect(clip.getSnapshot().value.fadeInShape).not.toBe(before);
  });

  test("an input trims the start to a position", () => {
    const clip = create();
    clip.edgeTypeAt("trim-start", 12, new Event("input"));
    expect(clip.getSnapshot().value.start).toBe(12);
  });
});

describe("Clip controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const clip = create();
    const listener = mock(() => undefined);
    const unsubscribe = clip.subscribe(listener);
    clip.keyDown(key("ArrowRight"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    clip.keyDown(key("ArrowRight"));
    expect(listener).not.toHaveBeenCalled();
  });
});
