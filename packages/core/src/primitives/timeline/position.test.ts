import { describe, expect, mock, test } from "bun:test";
import { createTimelineController, type TimelineOptions } from "./position";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<TimelineOptions> = {}) =>
  createTimelineController({
    duration: 10,
    grid: { offset: 0, step: 0 },
    largeStep: 1,
    maxZoom: Number.POSITIVE_INFINITY,
    minZoom: 0,
    step: 0.1,
    ...options,
  });

describe("Timeline controller position", () => {
  test("starts at the default position, clamped to the timeline", () => {
    expect(create().getSnapshot().position).toBe(0);
    expect(create({ defaultPosition: 42 }).getSnapshot().position).toBe(10);
  });

  test("a controlled position is shown as given, and a seek only reports itself", () => {
    const onPositionChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const timeline = create({ onPositionChange, position: 3 });
    expect(timeline.seek(7, new Event("input") as never)).toBe(true);
    expect(timeline.getSnapshot().position).toBe(3);
    expect(onPositionChange).toHaveBeenCalledTimes(1);
  });

  test("a live source is followed, and takes precedence over the position", () => {
    let live = 2;
    const timeline = create({
      position: 9,
      source: { getSnapshot: () => live, subscribe: () => () => undefined },
    });
    expect(timeline.getSnapshot().position).toBe(2);
    live = 5;
    expect(timeline.getSnapshot().position).toBe(5);
  });

  test("a scrub shows the position it reached, and the known one again once it ends", () => {
    const timeline = create({ defaultPosition: 1 });
    timeline.setScrubbing(true);
    timeline.seek(4, new Event("input") as never);
    expect(timeline.getSnapshot().position).toBe(4);
    timeline.setScrubbing(false);
    expect(timeline.getSnapshot().position).toBe(4);
    expect(timeline.getSnapshot().scrubbing).toBe(false);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const timeline = create({ position: 2 });
    expect(timeline.getSnapshot()).toBe(timeline.getSnapshot());
  });
});

describe("Timeline controller keys", () => {
  test("arrows move a step, Shift a large step, Home and End go to the ends", () => {
    const onPositionCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const timeline = create({ defaultPosition: 5, onPositionCommitted });
    expect(timeline.keyDown(key("ArrowRight", { shiftKey: true }))).toBe(true);
    expect(timeline.getSnapshot().position).toBe(6);
    timeline.keyDown(key("End"));
    expect(timeline.getSnapshot().position).toBe(10);
    timeline.keyDown(key("Home"));
    expect(timeline.getSnapshot().position).toBe(0);
    expect(onPositionCommitted).toHaveBeenCalledTimes(3);
  });

  test("a key that is not the timeline's is left alone, and a disabled one ignores keys", () => {
    expect(create().keyDown(key("a"))).toBe(false);
    expect(create({ disabled: true }).keyDown(key("ArrowUp"))).toBe(false);
  });
});

describe("Timeline controller zoom", () => {
  test("a zoom is clamped to its limits and reported", () => {
    const onZoomChange = mock((_zoom: unknown, _details: unknown) => undefined);
    const timeline = create({ maxZoom: 50, minZoom: 10, onZoomChange });
    expect(timeline.zoomTo(500, new Event("wheel") as never)).toBe(true);
    expect(timeline.getSnapshot().zoom).toBe(50);
    expect(onZoomChange.mock.calls[0]?.[0]).toBe(50);
  });

  test("a controlled zoom stays as given; the fit is a null zoom", () => {
    const timeline = create({ zoom: 20 });
    timeline.zoomTo(30, new Event("wheel") as never);
    expect(timeline.getSnapshot().zoom).toBe(20);
    expect(create().getSnapshot().fitted).toBe(true);
  });

  test("zooming to the zoom already set changes nothing", () => {
    const timeline = create({ defaultZoom: 20 });
    expect(timeline.zoomTo(20, new Event("wheel") as never)).toBe(false);
  });
});

describe("Timeline controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const timeline = create({ defaultPosition: 1 });
    const listener = mock(() => undefined);
    const unsubscribe = timeline.subscribe(listener);
    timeline.keyDown(key("ArrowRight"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    timeline.keyDown(key("ArrowRight"));
    expect(listener).not.toHaveBeenCalled();
  });
});
