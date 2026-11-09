import { describe, expect, test } from "bun:test";
import { createPointerLock } from "./gesture.ts";

const pointer = (type: string, pointerId: number) =>
  new PointerEvent(type, {
    buttons: type === "pointerup" ? 0 : 1,
    pointerId,
    pointerType: "touch",
  });

describe("createPointerLock", () => {
  test("while one pointer drags, a press from another is busy, until the first ends", () => {
    const lock = createPointerLock();
    const target = document.createElement("div");
    const ended: number[] = [];
    expect(lock.busy(pointer("pointerdown", 1))).toBe(false);
    lock.follow(
      target,
      1,
      () => undefined,
      (event) => ended.push(event.pointerId)
    );
    expect(lock.busy(pointer("pointerdown", 2))).toBe(true);
    // Another pointer's release doesn't end the first one's drag.
    document.dispatchEvent(pointer("pointerup", 2));
    expect(lock.busy(pointer("pointerdown", 2))).toBe(true);
    document.dispatchEvent(pointer("pointerup", 1));
    expect(ended).toEqual([1]);
    expect(lock.busy(pointer("pointerdown", 2))).toBe(false);
  });

  test("the same pointer pressing again is never busy, as after a missed release", () => {
    const lock = createPointerLock();
    lock.follow(
      document.createElement("div"),
      1,
      () => undefined,
      () => undefined
    );
    expect(lock.busy(pointer("pointerdown", 1))).toBe(false);
    document.dispatchEvent(pointer("pointerup", 1));
  });
});
