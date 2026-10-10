import { describe, expect, test } from "bun:test";
import { isReleased } from "./pointer";

describe("isReleased", () => {
  test("a mouse or pen move with no button down means the release was missed", () => {
    expect(isReleased({ buttons: 0, pointerType: "mouse" })).toBe(true);
    expect(isReleased({ buttons: 0, pointerType: "pen" })).toBe(true);
  });

  test("a move with a button down is a drag going on", () => {
    expect(isReleased({ buttons: 1, pointerType: "mouse" })).toBe(false);
    expect(isReleased({ buttons: 1, pointerType: "pen" })).toBe(false);
  });

  test("touch is never judged by its buttons", () => {
    expect(isReleased({ buttons: 0, pointerType: "touch" })).toBe(false);
  });

  test("an event that does not say what it is keeps the drag", () => {
    expect(isReleased({ buttons: 0, pointerType: "" })).toBe(false);
  });
});
