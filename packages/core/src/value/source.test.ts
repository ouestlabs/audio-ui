import { describe, expect, mock, test } from "bun:test";
import { createSource } from "./source.js";

describe("createSource", () => {
  test("holds its initial value until one is published", () => {
    const source = createSource(3);
    expect(source.getSnapshot()).toBe(3);
    source.set(7);
    expect(source.getSnapshot()).toBe(7);
  });

  test("tells every subscriber on each publish, until they unsubscribe", () => {
    const source = createSource(0);
    const first = mock(() => undefined);
    const second = mock(() => undefined);
    const unsubscribe = source.subscribe(first);
    source.subscribe(second);

    source.set(1);
    unsubscribe();
    source.set(2);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  test("publishes the same array again once it was updated in place", () => {
    const levels = new Float32Array(2);
    const source = createSource(levels);
    const listener = mock(() => undefined);
    source.subscribe(listener);

    levels[0] = 0.5;
    source.set(levels);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getSnapshot()[0]).toBe(0.5);
  });
});
