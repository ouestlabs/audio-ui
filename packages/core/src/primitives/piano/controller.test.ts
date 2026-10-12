import { describe, expect, mock, test } from "bun:test";
import {
  createPianoController,
  KEYBOARD_VELOCITY,
  type PianoOptions,
} from "./controller";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<PianoOptions> = {}) =>
  createPianoController({
    layout: "keyboard",
    maxPitch: 72,
    minPitch: 48,
    orientation: "horizontal",
    ...options,
  });

describe("Piano keys and their tab stop", () => {
  test("the keys run from the minimum to the maximum pitch, the tab stop starts on middle C", () => {
    const snapshot = create().getSnapshot();
    expect(snapshot.pitches[0]).toBe(48);
    expect(snapshot.pitches.at(-1)).toBe(72);
    expect(snapshot.tabStop).toBe(60);
  });

  test("an explicit list of pitches is sorted and kept without repeats", () => {
    const snapshot = create({ pitches: [64, 60, 64, 62] }).getSnapshot();
    expect(snapshot.pitches).toEqual([60, 62, 64]);
    expect(snapshot.tabStop).toBe(60);
  });

  test("arrows move to the next key, Shift an octave, and Home and End to the ends", () => {
    const piano = create({ pitches: [60, 62, 64, 65, 67, 69, 71, 72] });
    expect(piano.navigate(60, key("ArrowRight"))).toBe(62);
    expect(piano.navigate(60, key("ArrowRight", { shiftKey: true }))).toBe(72);
    expect(piano.navigate(60, key("End"))).toBe(72);
    expect(piano.navigate(60, key("Home"))).toBe(60);
    expect(piano.navigate(60, key("a"))).toBeNull();
  });

  test("focusing a key moves the tab stop to it", () => {
    const piano = create();
    piano.focusKey(67);
    expect(piano.getSnapshot().tabStop).toBe(67);
  });
});

describe("Piano keys pressed from the keyboard", () => {
  test("Enter sounds a key at the keyboard velocity until it is released", () => {
    const onNoteOn = mock((_pitch: number, _details: unknown) => undefined);
    const onNoteOff = mock((_pitch: number, _details: unknown) => undefined);
    const piano = create({ onNoteOn, onNoteOff });
    piano.keyOn(60, key("Enter"));
    expect(piano.getSnapshot().active.has(60)).toBe(true);
    const [, details] = onNoteOn.mock.calls[0] as unknown as [
      number,
      { velocity: number },
    ];
    expect(details.velocity).toBe(KEYBOARD_VELOCITY);
    piano.keyOff(60, new KeyboardEvent("keyup", { key: "Enter" }));
    expect(piano.getSnapshot().active.has(60)).toBe(false);
    expect(onNoteOff).toHaveBeenCalledTimes(1);
  });

  test("a repeated key press does not sound the key again", () => {
    const onNoteOn = mock((_pitch: number, _details: unknown) => undefined);
    const piano = create({ onNoteOn });
    piano.keyOn(60, key("Enter"));
    piano.keyOn(60, key("Enter", { repeat: true }));
    expect(onNoteOn).toHaveBeenCalledTimes(1);
  });

  test("a note on that is cancelled leaves the key silent", () => {
    const piano = create({
      onNoteOn: (_pitch, details) =>
        (details as { cancel: () => void }).cancel(),
    });
    piano.keyOn(60, key("Enter"));
    expect(piano.getSnapshot().active.has(60)).toBe(false);
  });
});

describe("Piano active notes and state", () => {
  test("keys listed as active light up with the keys pressed here", () => {
    const piano = create({ activeNotes: [48, 52] });
    piano.keyOn(60, key("Enter"));
    expect([...piano.getSnapshot().active].sort()).toEqual([48, 52, 60]);
  });

  test("a disabled keyboard sounds nothing", () => {
    const onNoteOn = mock((_pitch: number, _details: unknown) => undefined);
    const piano = create({ disabled: true, onNoteOn });
    piano.keyOn(60, key("Enter"));
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(piano.getSnapshot().disabled).toBe(true);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const piano = create();
    expect(piano.getSnapshot()).toBe(piano.getSnapshot());
  });

  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const piano = create();
    const listener = mock(() => undefined);
    const unsubscribe = piano.subscribe(listener);
    piano.keyOn(60, key("Enter"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    piano.keyOff(60, new KeyboardEvent("keyup", { key: "Enter" }));
    expect(listener).not.toHaveBeenCalled();
  });
});
