import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { lastCall, renderPiano } from "../helpers.js";

// White keys are 100px wide; black keys take the top 60px.
const C3 = { clientX: 50, clientY: 80 };
const D3 = { clientX: 150, clientY: 80 };
const C_SHARP_3 = { clientX: 100, clientY: 20 };

describe("Piano.Root", () => {
  test("renders a group with one key per pitch in the range", () => {
    const { keys, root } = renderPiano();
    expect(root.getAttribute("role")).toBe("group");
    expect(keys).toHaveLength(13);
  });

  test("plays the key under a press until it is released", () => {
    const { key, onNoteOff, onNoteOn, root } = renderPiano();
    fireEvent.pointerDown(root, { ...C3, button: 0, pointerId: 1 });
    expect(lastCall(onNoteOn)[0]).toBe(48);
    expect(lastCall(onNoteOn)[1].reason).toBe("press");
    expect(key(48).hasAttribute("data-active")).toBe(true);

    fireEvent.pointerUp(root, { ...C3, pointerId: 1 });
    expect(lastCall(onNoteOff)[0]).toBe(48);
    expect(key(48).hasAttribute("data-active")).toBe(false);
  });

  test("finds black keys at the back and white keys at the front", () => {
    const { onNoteOn, root } = renderPiano();
    fireEvent.pointerDown(root, { ...C_SHARP_3, button: 0, pointerId: 1 });
    expect(lastCall(onNoteOn)[0]).toBe(49);
  });

  test("a press near the free end of a key plays harder than one near the top", () => {
    const { onNoteOn, root } = renderPiano();
    fireEvent.pointerDown(root, {
      ...C3,
      button: 0,
      clientY: 95,
      pointerId: 1,
    });
    const hard = lastCall(onNoteOn)[1].velocity;
    fireEvent.pointerUp(root, { clientY: 95, pointerId: 1 });
    fireEvent.pointerDown(root, {
      ...C3,
      button: 0,
      clientY: 70,
      pointerId: 2,
    });
    const soft = lastCall(onNoteOn)[1].velocity;
    expect(hard).toBeGreaterThan(soft);
    expect(hard).toBeLessThanOrEqual(1);
    expect(soft).toBeGreaterThanOrEqual(0.25);
  });

  test("a key played from the keyboard has a fixed middling velocity", () => {
    const { key, onNoteOn } = renderPiano();
    fireEvent.keyDown(key(48), { key: "Enter" });
    expect(lastCall(onNoteOn)[1].velocity).toBe(0.8);
  });

  test("glides from key to key while the pointer is down", () => {
    const { onNoteOff, onNoteOn, root } = renderPiano();
    fireEvent.pointerDown(root, { ...C3, button: 0, pointerId: 1 });
    fireEvent.pointerMove(root, { ...D3, pointerId: 1 });
    expect(lastCall(onNoteOff)).toMatchObject([48, { reason: "glide" }]);
    expect(lastCall(onNoteOn)[0]).toBe(50);
    expect(lastCall(onNoteOn)[1].reason).toBe("glide");
  });

  test("holds one key per pointer, for chords", () => {
    const { key, root } = renderPiano();
    fireEvent.pointerDown(root, { ...C3, button: 0, pointerId: 1 });
    fireEvent.pointerDown(root, { ...D3, button: 0, pointerId: 2 });
    fireEvent.pointerUp(root, { ...C3, pointerId: 1 });
    expect(key(48).hasAttribute("data-active")).toBe(false);
    expect(key(50).hasAttribute("data-active")).toBe(true);
  });

  test("keeps a cancelled note silent, with nothing to release", () => {
    const { key, onNoteOff, root } = renderPiano({
      onNoteOn: (_pitch, details) => details.cancel(),
    });
    fireEvent.pointerDown(root, { ...C3, button: 0, pointerId: 1 });
    expect(key(48).hasAttribute("data-active")).toBe(false);
    fireEvent.pointerUp(root, { ...C3, pointerId: 1 });
    expect(onNoteOff).not.toHaveBeenCalled();
  });

  test("lights the activeNotes alongside the pressed keys", () => {
    const { key, root } = renderPiano({ activeNotes: [52] });
    fireEvent.pointerDown(root, { ...C3, button: 0, pointerId: 1 });
    expect(key(48).hasAttribute("data-active")).toBe(true);
    expect(key(52).hasAttribute("data-active")).toBe(true);
    expect(key(50).hasAttribute("data-active")).toBe(false);
  });

  test("ignores the pointer when disabled", () => {
    const { onNoteOn, root } = renderPiano({ disabled: true });
    fireEvent.pointerDown(root, { ...C3, button: 0, pointerId: 1 });
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(root.hasAttribute("data-disabled")).toBe(true);
  });

  test("shows only the given pitches, evenly, low end at the bottom when vertical", () => {
    const { key, keys, onNoteOn, root } = renderPiano({
      layout: "even",
      orientation: "vertical",
      pitches: [67, 60, 64],
    });
    expect(keys.map((element) => element.getAttribute("aria-label"))).toEqual([
      "C4",
      "E4",
      "G4",
    ]);
    expect(key(60).style.bottom).toBe("0%");
    expect(Number.parseFloat(key(67).style.height)).toBeCloseTo(100 / 3);
    // The keyboard is 100px tall: the top third is G4.
    fireEvent.pointerDown(root, {
      button: 0,
      clientX: 700,
      clientY: 10,
      pointerId: 1,
    });
    expect(lastCall(onNoteOn)[0]).toBe(67);
    expect(root.getAttribute("data-orientation")).toBe("vertical");
  });
});
