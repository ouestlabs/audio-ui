import { afterEach, describe, expect, test } from "bun:test";
import { matchShortcut } from "@/lib/daw/shortcuts";

const platform = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  "platform"
);
function on(system: string) {
  Object.defineProperty(globalThis.navigator, "platform", {
    configurable: true,
    value: system,
  });
}
afterEach(() => {
  if (platform) {
    Object.defineProperty(globalThis.navigator, "platform", platform);
  }
});

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    altKey: false,
    code: "",
    ctrlKey: false,
    key,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  }) as KeyboardEvent;

describe("the keyboard", () => {
  test("KEY-001 and KEY-002: Space plays or stops, Shift+Space continues", () => {
    on("MacIntel");
    expect(matchShortcut(press(" "))).toBe("play-stop");
    expect(matchShortcut(press(" ", { shiftKey: true }))).toBe("continue");
  });

  test("KEY-005: Cmd on a Mac, Ctrl elsewhere", () => {
    on("MacIntel");
    expect(matchShortcut(press("z", { metaKey: true }))).toBe("undo");
    expect(matchShortcut(press("z", { ctrlKey: true }))).toBeNull();
    on("Win32");
    expect(matchShortcut(press("z", { ctrlKey: true }))).toBe("undo");
    expect(matchShortcut(press("Z", { ctrlKey: true, shiftKey: true }))).toBe(
      "redo"
    );
  });

  test("KEY-006 and KEY-007: Ctrl+T stands in for the Cmd+T the browser keeps on a Mac", () => {
    on("MacIntel");
    expect(matchShortcut(press("t", { ctrlKey: true }))).toBe("audio-track");
    expect(matchShortcut(press("T", { ctrlKey: true, shiftKey: true }))).toBe(
      "midi-track"
    );
  });

  test("KEY-008 and KEY-020: a key with Option is read by where it sits, as Option changes the letter", () => {
    on("MacIntel");
    expect(
      matchShortcut(press("†", { altKey: true, code: "KeyT", metaKey: true }))
    ).toBe("return-track");
    expect(
      matchShortcut(press("µ", { altKey: true, code: "KeyM", metaKey: true }))
    ).toBe("mixer");
  });

  test("KEY-011 and KEY-010: 0 deactivates, S solos, alone", () => {
    on("MacIntel");
    expect(matchShortcut(press("0"))).toBe("deactivate");
    expect(matchShortcut(press("s"))).toBe("solo");
    expect(matchShortcut(press("s", { metaKey: true }))).toBeNull();
  });
});
