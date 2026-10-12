import { describe, expect, mock, test } from "bun:test";
import { createWaveformController, type WaveformSeekOptions } from "./seek";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<WaveformSeekOptions> = {}) =>
  createWaveformController({
    duration: 10,
    largeStep: 1,
    range: [0, 10],
    step: 0.1,
    ...options,
  });

describe("Waveform seek controller position", () => {
  test("starts at the default position, clamped to the audio", () => {
    expect(create().getSnapshot().value).toBe(0);
    expect(create({ defaultValue: 42 }).getSnapshot().value).toBe(10);
  });

  test("a controlled position is shown as given, and a change only reports itself", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const seek = create({ onValueChange, value: 3 });
    seek.typeAt(7, new Event("input"));
    expect(seek.getSnapshot().value).toBe(3);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("a live source is followed, and takes precedence over the value", () => {
    let position = 2;
    const seek = create({
      source: { getSnapshot: () => position, subscribe: () => () => undefined },
      value: 9,
    });
    expect(seek.getSnapshot().value).toBe(2);
    position = 5;
    expect(seek.getSnapshot().value).toBe(5);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const seek = create({ value: 4 });
    expect(seek.getSnapshot()).toBe(seek.getSnapshot());
  });

  test("the shares follow the stretch shown", () => {
    const seek = create({ range: [2, 6] });
    expect(seek.toShare(4)).toBe(0.5);
    expect(seek.atShare(0.25)).toBe(3);
  });
});

describe("Waveform seek controller keys and input", () => {
  test("arrows move a step, Shift a large step, and the keys stay in the stretch", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const seek = create({ defaultValue: 3, onValueCommitted, range: [2, 4] });
    expect(seek.keyDown(key("ArrowRight", { shiftKey: true }))).toBe(true);
    expect(seek.getSnapshot().value).toBe(4);
    expect(seek.keyDown(key("Home"))).toBe(true);
    expect(seek.getSnapshot().value).toBe(2);
    expect(onValueCommitted).toHaveBeenCalledTimes(2);
  });

  test("a key that is not the seek's is left alone", () => {
    expect(create().keyDown(key("a"))).toBe(false);
  });

  test("a loading or disabled waveform ignores keys and input", () => {
    const loading = create({ loading: true, value: 1 });
    expect(loading.keyDown(key("ArrowRight"))).toBe(false);
    loading.typeAt(5, new Event("input"));
    expect(loading.getSnapshot().value).toBe(1);
    expect(create({ disabled: true }).keyDown(key("ArrowUp"))).toBe(false);
  });

  test("an input sets the position and commits it", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const seek = create({ onValueCommitted });
    seek.typeAt(6.5, new Event("input"));
    expect(seek.getSnapshot().value).toBe(6.5);
    expect(onValueCommitted.mock.calls[0]?.[0]).toBe(6.5);
  });
});

describe("Waveform seek controller hover and subscriptions", () => {
  test("leaving clears the hover", () => {
    const seek = create();
    seek.leave();
    expect(seek.hover.get()).toBeNull();
  });

  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const seek = create({ value: 1 });
    const listener = mock(() => undefined);
    const unsubscribe = seek.subscribe(listener);
    seek.keyDown(key("ArrowRight"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    seek.keyDown(key("ArrowRight"));
    expect(listener).not.toHaveBeenCalled();
  });
});
