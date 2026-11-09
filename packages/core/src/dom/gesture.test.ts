import { describe, expect, test } from "bun:test";
import { createPointerLock } from "./gesture.ts";

const pointer = (type: string, pointerId: number) =>
  new PointerEvent(type, {
    buttons: type === "pointerup" ? 0 : 1,
    pointerId,
    pointerType: "touch",
  });

describe("createPointerLock", () => {
  test("while one pointer drags, a press from another can't claim the control, until the first ends", () => {
    const lock = createPointerLock();
    const target = document.createElement("div");
    const ended: number[] = [];
    expect(lock.claim(pointer("pointerdown", 1))).toBe(true);
    lock.follow(
      target,
      1,
      () => undefined,
      (event) => ended.push(event.pointerId)
    );
    expect(lock.claim(pointer("pointerdown", 2))).toBe(false);
    // Another pointer's release doesn't end the first one's drag.
    document.dispatchEvent(pointer("pointerup", 2));
    expect(lock.claim(pointer("pointerdown", 2))).toBe(false);
    document.dispatchEvent(pointer("pointerup", 1));
    expect(ended).toEqual([1]);
    expect(lock.claim(pointer("pointerdown", 2))).toBe(true);
  });

  test("the same pointer pressing again ends the drag its missed release left, which then hears nothing more", () => {
    const lock = createPointerLock();
    const target = document.createElement("div");
    const moves: string[] = [];
    const ends: string[] = [];
    lock.follow(
      target,
      1,
      () => moves.push("old"),
      (event) => ends.push(`old ${event.type}`)
    );
    const press = pointer("pointerdown", 1);
    expect(lock.claim(press)).toBe(true);
    expect(ends).toEqual(["old pointerdown"]);
    lock.follow(
      target,
      1,
      () => moves.push("new"),
      (event) => ends.push(`new ${event.type}`)
    );
    document.dispatchEvent(pointer("pointermove", 1));
    document.dispatchEvent(pointer("pointerup", 1));
    expect(moves).toEqual(["new"]);
    expect(ends).toEqual(["old pointerdown", "new pointerup"]);
    expect(lock.claim(pointer("pointerdown", 2))).toBe(true);
  });
});
