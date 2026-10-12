import { describe, expect, mock, test } from "bun:test";
import {
  createPianoRollController,
  type PianoRollOptions,
} from "./controller.ts";
import type { Note } from "./edits.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const NOTES: Note[] = [
  { id: "a", length: 1, pitch: 60, start: 0, velocity: 0.5 },
  { id: "b", length: 1, pitch: 64, start: 2 },
];

const create = (options: Partial<PianoRollOptions> = {}) =>
  createPianoRollController({
    timeline: {
      duration: 16,
      grid: { offset: 0, step: 1 },
      position: () => 4,
      step: 0.25,
      zoom: 10,
    },
    defaultValue: NOTES,
    ...options,
  });

describe("Piano roll controller notes", () => {
  test("holds the notes, sorted and sanitized, and rows cover the range", () => {
    const roll = create({ minPitch: 60, maxPitch: 64 });
    const snapshot = roll.getSnapshot();
    expect(snapshot.notes.map((note) => note.id)).toEqual(["a", "b"]);
    expect(snapshot.rows.pitches).toEqual([64, 63, 62, 61, 60]);
  });

  test("the snapshot is the same object while nothing it shows has changed", () => {
    const roll = create();
    expect(roll.getSnapshot()).toBe(roll.getSnapshot());
  });

  test("an arrow moves the note under the cursor by one step and commits it", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const roll = create({ onValueCommitted });
    expect(roll.keyNote("a", key("ArrowRight"))).toBe(true);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    const committed = onValueCommitted.mock.calls[0]?.[0] as unknown as Note[];
    expect(committed.find((note) => note.id === "a")?.start).toBeCloseTo(
      0.25,
      10
    );
  });

  test("Delete removes the selection and asks the view to focus the neighbour", () => {
    const requestFocus = mock((_target: unknown) => undefined);
    const roll = create({
      defaultSelection: ["a"],
      requestFocus,
    });
    expect(roll.keyNote("a", key("Delete"))).toBe(true);
    expect(requestFocus).toHaveBeenCalledWith("b");
  });

  test("a double click removes the note", () => {
    const roll = create();
    roll.doubleClickNote("b", new MouseEvent("dblclick"));
    expect(roll.getSnapshot().notes.map((note) => note.id)).toEqual(["a"]);
  });
});

describe("Piano roll controller commands", () => {
  test("Cmd+D duplicates the selection right after itself", () => {
    const roll = create({ defaultSelection: ["a"] });
    expect(roll.shortcut(key("d", { metaKey: true }))).toBe(true);
    expect(roll.getSnapshot().notes).toHaveLength(3);
    expect(roll.getSnapshot().selection.size).toBe(1);
  });

  test("Q quantizes every note when nothing is selected", () => {
    const roll = create({
      defaultValue: [{ id: "x", length: 1, pitch: 60, start: 0.4 }],
    });
    expect(roll.shortcut(key("q"))).toBe(true);
    expect(roll.getSnapshot().notes[0]?.start).toBe(0);
  });

  test("Escape clears the selection and Cmd+A selects every note", () => {
    const roll = create({ defaultSelection: ["a"] });
    roll.keyGrid(key("a", { metaKey: true }));
    expect([...roll.getSnapshot().selection]).toEqual(["a", "b"]);
    roll.keyGrid(key("Escape"));
    expect(roll.getSnapshot().selection.size).toBe(0);
  });
});

describe("Piano roll controller keys and velocity", () => {
  test("Shift on a key selects every note on its row, and gives them back", () => {
    const roll = create();
    const details = {
      cancel: () => undefined,
      event: new KeyboardEvent("keydown", { key: "k", shiftKey: true }),
      isCanceled: false,
      reason: "press" as const,
    };
    roll.keyOn(60, details as never);
    expect([...roll.getSnapshot().selection]).toEqual(["a"]);
    roll.keyOn(60, details as never);
    expect(roll.getSnapshot().selection.size).toBe(0);
  });

  test("arrows change the velocity of the note, clamped to 0…1", () => {
    const roll = create();
    expect(roll.keyVelocity("a", key("PageUp"))).toBe(true);
    expect(
      roll.getSnapshot().notes.find((note) => note.id === "a")?.velocity
    ).toBe(0.75);
    roll.keyVelocity("a", key("End"));
    expect(
      roll.getSnapshot().notes.find((note) => note.id === "a")?.velocity
    ).toBe(1);
  });

  test("a disabled roll ignores keys", () => {
    const roll = create({ disabled: true });
    expect(roll.keyNote("a", key("ArrowRight"))).toBe(false);
  });
});

describe("Piano roll controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const roll = create();
    const listener = mock(() => undefined);
    const unsubscribe = roll.subscribe(listener);
    roll.keyNote("a", key("ArrowRight"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    roll.keyNote("a", key("ArrowRight"));
    expect(listener).not.toHaveBeenCalled();
  });
});
