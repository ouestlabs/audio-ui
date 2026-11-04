import { describe, expect, test } from "bun:test";
import {
  isComputerKeyboardKey,
  noteOfKey,
} from "@/registry-audio/bases/base/lib/computer-keyboard";

describe("computer keyboard", () => {
  test("REC-002: the middle row plays the white keys from C, the row above the black ones, by where the keys sit", () => {
    expect(noteOfKey("KeyA", 0)).toBe(60);
    expect(noteOfKey("KeyW", 0)).toBe(61);
    expect(noteOfKey("KeyS", 0)).toBe(62);
    expect(noteOfKey("KeyJ", 0)).toBe(71);
    expect(noteOfKey("KeyK", 0)).toBe(72);
    expect(noteOfKey("Quote", 0)).toBe(77);
    expect(noteOfKey("KeyA", -1)).toBe(48);
    expect(noteOfKey("KeyA", 2)).toBe(84);
    expect(noteOfKey("KeyQ", 0)).toBeNull();
    expect(noteOfKey("KeyA", 6)).toBeNull();
  });

  test("leaves every other key to the page", () => {
    expect(isComputerKeyboardKey("KeyZ")).toBe(true);
    expect(isComputerKeyboardKey("KeyA")).toBe(true);
    expect(isComputerKeyboardKey("KeyM")).toBe(false);
    expect(isComputerKeyboardKey("Space")).toBe(false);
  });
});
