import { describe, expect, mock, test } from "bun:test";
import { piano } from "../src/piano/index.ts";

/** The piano with no framework: its keys registered as the elements of a document. */
function instance(options: Record<string, unknown> = {}) {
  const onNoteOn = mock(
    (
      _pitch: number,
      _details: { source?: string; velocity: number; cancel: () => void }
    ) => undefined
  );
  const onNoteOff = mock(
    (_pitch: number, _details: { reason: string }) => undefined
  );
  const keyboard = piano({
    id: "k",
    maxPitch: 64,
    minPitch: 60,
    onNoteOff,
    onNoteOn,
    ...options,
  } as never);
  return { keyboard, onNoteOff, onNoteOn };
}

const enter = () => new KeyboardEvent("keydown", { key: "Enter" });

describe("the piano primitive", () => {
  test("the range makes the keys, lowest first, and the tab stop starts on middle C", () => {
    const { keyboard } = instance();
    expect(keyboard.get().view.pitches).toEqual([60, 61, 62, 63, 64]);
    expect(keyboard.get().view.tabStop).toBe(60);
  });

  test("a key played from the keyboard sounds with a velocity and its source", () => {
    const { keyboard, onNoteOn } = instance();
    keyboard.api.controller.keyOn(62, enter());
    const [pitch, details] = onNoteOn.mock.calls[0] ?? [];
    expect(pitch).toBe(62);
    expect(details?.velocity).toBe(0.8);
    expect(details?.source).toBe("keyboard");
    expect(keyboard.get().view.active.has(62)).toBe(true);
  });

  test("a note an app refuses is silent", () => {
    const { keyboard } = instance({
      onNoteOn: (_pitch: number, details: { cancel: () => void }) =>
        details.cancel(),
    });
    keyboard.api.controller.keyOn(62, enter());
    expect(keyboard.get().view.active.has(62)).toBe(false);
  });

  test("a release stops the note", () => {
    const { keyboard, onNoteOff } = instance();
    keyboard.api.controller.keyOn(62, enter());
    keyboard.api.controller.keyOff(
      62,
      new KeyboardEvent("keyup", { key: "Enter" })
    );
    expect(onNoteOff.mock.calls[0]?.[0]).toBe(62);
    expect(keyboard.get().view.active.has(62)).toBe(false);
  });

  test("notes lit from elsewhere are active", () => {
    const { keyboard } = instance({ activeNotes: [61, 63] });
    expect([...keyboard.get().view.active]).toEqual([61, 63]);
  });
});
