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

  test("KEY-016: Cmd+1 to 5 change the grid, by the digit's place on any layout", () => {
    on("MacIntel");
    expect(matchShortcut(press("1", { code: "Digit1", metaKey: true }))).toBe(
      "grid-finer"
    );
    // AZERTY: the key that sits where 5 is gives "(" without Shift.
    expect(matchShortcut(press("(", { code: "Digit5", metaKey: true }))).toBe(
      "grid-fixed"
    );
  });

  test("KEY-017 and KEY-018: Cmd+= and Cmd+- zoom, Z zooms onto the selection, X back", () => {
    on("MacIntel");
    expect(matchShortcut(press("=", { code: "Equal", metaKey: true }))).toBe(
      "zoom-in"
    );
    expect(matchShortcut(press("-", { code: "Minus", metaKey: true }))).toBe(
      "zoom-out"
    );
    expect(matchShortcut(press("z", { code: "KeyZ" }))).toBe("zoom-selection");
    expect(matchShortcut(press("x", { code: "KeyX" }))).toBe("zoom-back");
  });

  test("KEY-019: U folds the selected tracks, Option+U unfolds them all", () => {
    on("MacIntel");
    expect(matchShortcut(press("u", { code: "KeyU" }))).toBe("fold");
    expect(matchShortcut(press("¨", { altKey: true, code: "KeyU" }))).toBe(
      "unfold-all"
    );
  });

  test("KEY-027: A shows or hides the automation, alone", () => {
    on("MacIntel");
    expect(matchShortcut(press("a", { code: "KeyA" }))).toBe("automation");
    expect(matchShortcut(press("a", { code: "KeyA", metaKey: true }))).toBe(
      "select-all"
    );
  });

  test("KEY-021: Cmd+Option+B shows or folds the library, Ctrl+Alt+B off a Mac", () => {
    on("MacIntel");
    expect(
      matchShortcut(press("∫", { altKey: true, code: "KeyB", metaKey: true }))
    ).toBe("library");
    on("Win32");
    expect(
      matchShortcut(press("b", { altKey: true, code: "KeyB", ctrlKey: true }))
    ).toBe("library");
  });

  test("KEY-011 and KEY-010: 0 deactivates, S solos, alone", () => {
    on("MacIntel");
    expect(matchShortcut(press("0"))).toBe("deactivate");
    expect(matchShortcut(press("s"))).toBe("solo");
    expect(matchShortcut(press("s", { ctrlKey: true }))).toBeNull();
  });

  test("KEY-032: Cmd+O opens, Cmd+S saves, Cmd+Shift+S saves to another folder", () => {
    on("MacIntel");
    expect(matchShortcut(press("o", { metaKey: true }))).toBe("open");
    expect(matchShortcut(press("s", { metaKey: true }))).toBe("save");
    expect(matchShortcut(press("s", { metaKey: true, shiftKey: true }))).toBe(
      "save-as"
    );
  });

  test("KEY-035: Cmd+Shift+Comma opens the settings, Cmd+Comma stays the browser's", () => {
    on("MacIntel");
    // Shift turns the comma into "<" on most layouts: the key is matched by its place.
    expect(
      matchShortcut(
        press("<", { code: "Comma", metaKey: true, shiftKey: true })
      )
    ).toBe("settings");
    expect(
      matchShortcut(press(",", { code: "Comma", metaKey: true }))
    ).toBeNull();
  });
});
