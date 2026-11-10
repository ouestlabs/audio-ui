import { describe, expect, test } from "bun:test";
import "../src/piano/index.ts";
import type {
  PianoElement,
  PianoNoteOffDetail,
  PianoNoteOnDetail,
} from "../src/piano/index.ts";
import { key as keyPress, mockRect, pointer } from "./helpers.ts";

/** C3 (48) to C4 (60) on an 800×100 keyboard at the origin: eight white keys 100 px wide, five black ones. */
function renderPiano(attributes = "") {
  document.body.innerHTML = `
    <audio-ui-piano aria-label="Piano" min-pitch="48" max-pitch="60" ${attributes}>
      <audio-ui-piano-keys>
        <template><audio-ui-piano-key-label></audio-ui-piano-key-label></template>
      </audio-ui-piano-keys>
    </audio-ui-piano>`;
  const root = document.querySelector("audio-ui-piano") as PianoElement;
  mockRect(root, { bottom: 100, height: 100, right: 800, width: 800 });
  const on: Omit<PianoNoteOnDetail, "event">[] = [];
  const off: Omit<PianoNoteOffDetail, "event">[] = [];
  // The fields the tests read, not the event: a report of a failed match would walk its whole document.
  root.addEventListener("noteon", (event) => {
    const { pitch, reason, velocity } = event.detail;
    on.push({ pitch, reason, velocity });
  });
  root.addEventListener("noteoff", (event) => {
    const { pitch, reason } = event.detail;
    off.push({ pitch, reason });
  });
  return {
    key: (pitch: number) =>
      root.querySelector(`audio-ui-piano-key[pitch="${pitch}"]`) as HTMLElement,
    keys: () => [...root.querySelectorAll<HTMLElement>("audio-ui-piano-key")],
    off,
    on,
    root,
  };
}

// White keys are 100 px wide; black keys take the top 60 px.
const C3 = { clientX: 50, clientY: 80 };
const D3 = { clientX: 150, clientY: 80 };
const C_SHARP_3 = { clientX: 100, clientY: 20 };

describe("the piano", () => {
  test("is a group with one key per pitch in the range", () => {
    const { keys, root } = renderPiano();
    expect(root.getAttribute("role")).toBe("group");
    expect(keys()).toHaveLength(13);
  });

  test("plays the key under a press until it is released", () => {
    const { key, off, on, root } = renderPiano();
    pointer(root, "pointerdown", { ...C3, pointerId: 1 });
    expect(on.at(-1)).toMatchObject({ pitch: 48, reason: "press" });
    expect(key(48).hasAttribute("data-active")).toBe(true);
    pointer(root, "pointerup", { ...C3, pointerId: 1 });
    expect(off.at(-1)?.pitch).toBe(48);
    expect(key(48).hasAttribute("data-active")).toBe(false);
  });

  test("finds black keys at the back and white keys at the front", () => {
    const { on, root } = renderPiano();
    pointer(root, "pointerdown", { ...C_SHARP_3, pointerId: 1 });
    expect(on.at(-1)?.pitch).toBe(49);
  });

  test("a press near the free end of a key plays harder than one near the top; a key from the keyboard at 0.8", () => {
    const { key, on, root } = renderPiano();
    pointer(root, "pointerdown", { ...C3, clientY: 95, pointerId: 1 });
    const hard = on.at(-1)?.velocity ?? 0;
    pointer(root, "pointerup", { clientY: 95, pointerId: 1 });
    pointer(root, "pointerdown", { ...C3, clientY: 70, pointerId: 2 });
    const soft = on.at(-1)?.velocity ?? 0;
    expect(hard).toBeGreaterThan(soft);
    expect(hard).toBeLessThanOrEqual(1);
    expect(soft).toBeGreaterThanOrEqual(0.25);
    pointer(root, "pointerup", { clientY: 70, pointerId: 2 });
    key(48).focus();
    key(48).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
    );
    expect(on.at(-1)?.velocity).toBe(0.8);
  });

  test("glides from key to key while the pointer is down, and holds one key per pointer", () => {
    const { key, off, on, root } = renderPiano();
    pointer(root, "pointerdown", { ...C3, pointerId: 1 });
    pointer(root, "pointermove", { ...D3, pointerId: 1 });
    expect(off.at(-1)).toEqual({ pitch: 48, reason: "glide" });
    expect(on.at(-1)).toMatchObject({ pitch: 50, reason: "glide" });
    pointer(root, "pointerdown", { ...C3, pointerId: 2 });
    pointer(root, "pointerup", { ...C3, pointerId: 2 });
    expect(key(48).hasAttribute("data-active")).toBe(false);
    expect(key(50).hasAttribute("data-active")).toBe(true);
  });

  test("a canceled noteon keeps it silent, with nothing to release", () => {
    const { key, off, root } = renderPiano();
    root.addEventListener("noteon", (event) => event.preventDefault());
    pointer(root, "pointerdown", { ...C3, pointerId: 1 });
    expect(key(48).hasAttribute("data-active")).toBe(false);
    pointer(root, "pointerup", { ...C3, pointerId: 1 });
    expect(off).toEqual([]);
  });

  test("lights active-notes alongside the pressed keys, and the activeNotes property", () => {
    const { key, root } = renderPiano('active-notes="52"');
    pointer(root, "pointerdown", { ...C3, pointerId: 1 });
    expect(key(48).hasAttribute("data-active")).toBe(true);
    expect(key(52).hasAttribute("data-active")).toBe(true);
    expect(key(50).hasAttribute("data-active")).toBe(false);
    root.activeNotes = [55];
    expect(key(52).hasAttribute("data-active")).toBe(false);
    expect(key(55).hasAttribute("data-active")).toBe(true);
  });

  test("ignores the pointer when disabled, and its keys are out of the tab order", () => {
    const { keys, on, root } = renderPiano("disabled");
    pointer(root, "pointerdown", { ...C3, pointerId: 1 });
    expect(on).toEqual([]);
    expect(root.hasAttribute("data-disabled")).toBe(true);
    expect(keys().every((element) => element.tabIndex === -1)).toBe(true);
    expect(
      keys().every(
        (element) => element.getAttribute("aria-disabled") === "true"
      )
    ).toBe(true);
  });

  test("shows only the given pitches, evenly, low end at the bottom when vertical", () => {
    const { key, keys, on, root } = renderPiano(
      'layout="even" orientation="vertical" pitches="67 60 64"'
    );
    expect(keys().map((element) => element.getAttribute("aria-label"))).toEqual(
      ["C4", "E4", "G4"]
    );
    expect(key(60).style.bottom).toBe("0%");
    expect(Number.parseFloat(key(67).style.height)).toBeCloseTo(100 / 3);
    // The keyboard is 100 px tall: the top third is G4.
    pointer(root, "pointerdown", { clientX: 700, clientY: 10, pointerId: 1 });
    expect(on.at(-1)?.pitch).toBe(67);
    expect(root.getAttribute("data-orientation")).toBe("vertical");
  });

  test("makes the keys again when its range changes, keeping the ones that stay", () => {
    const { key, keys, root } = renderPiano();
    const c4 = key(60);
    root.setAttribute("max-pitch", "64");
    expect(keys()).toHaveLength(17);
    expect(key(60)).toBe(c4);
  });
});

describe("a key", () => {
  test("is a button named after its pitch, placed along the keyboard, with its color", () => {
    const { key } = renderPiano();
    expect(key(49).getAttribute("role")).toBe("button");
    expect(key(49).getAttribute("aria-label")).toBe("C#3");
    expect(key(49).getAttribute("data-color")).toBe("black");
    expect(key(50).getAttribute("data-color")).toBe("white");
    expect(key(50).style.left).toBe("12.5%");
  });

  test("the single tab stop is on middle C, or the lowest key without one", () => {
    const { key, keys } = renderPiano();
    expect(keys().filter((element) => element.tabIndex === 0)).toEqual([
      key(60),
    ]);
  });

  test("the arrows walk the keys, Shift an octave, Home and End to the ends", () => {
    const { key } = renderPiano();
    keyPress(key(60), "ArrowLeft");
    expect(document.activeElement).toBe(key(59));
    expect(key(59).tabIndex).toBe(0);
    expect(key(60).tabIndex).toBe(-1);
    keyPress(key(59), "ArrowDown", { shiftKey: true });
    expect(document.activeElement).toBe(key(48));
    keyPress(key(48), "ArrowLeft");
    expect(document.activeElement).toBe(key(48));
    keyPress(key(48), "End");
    expect(document.activeElement).toBe(key(60));
    keyPress(key(60), "Home");
    expect(document.activeElement).toBe(key(48));
  });

  test("sounds while Enter or Space is held, and is released when it loses focus", () => {
    const { key, off, on } = renderPiano();
    keyPress(key(60), " ");
    keyPress(key(60), " ", { repeat: true });
    expect(on).toHaveLength(1);
    expect(on.at(-1)?.reason).toBe("keyboard");
    expect(off).toEqual([]);
    key(60).dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: " " })
    );
    expect(off.at(-1)).toEqual({ pitch: 60, reason: "keyboard" });
    keyPress(key(60), "Enter");
    key(60).dispatchEvent(new FocusEvent("blur"));
    expect(off.at(-1)?.pitch).toBe(60);
  });

  test("holds a label with its pitch name, hidden from assistive technology", async () => {
    const { key } = renderPiano();
    // The keys take their template when they see it: once the markup is in.
    await Promise.resolve();
    const label = key(49).querySelector(
      "audio-ui-piano-key-label"
    ) as HTMLElement;
    expect(label.textContent).toBe("C#3");
    expect(label.getAttribute("aria-hidden")).toBe("true");
  });
});
