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

/** A 160×50 grid at the origin: 10px a unit across, five 10px rows down (64 to 60). */
const gridElement = () => {
  const element = document.createElement("div");
  document.body.append(element);
  element.getBoundingClientRect = () =>
    ({
      bottom: 50,
      height: 50,
      left: 0,
      right: 160,
      top: 0,
      width: 160,
    }) as DOMRect;
  return element;
};
const pointer = (type: string, x: number, y: number, extra = {}) =>
  new PointerEvent(type, {
    bubbles: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    ...extra,
  });

describe("Piano roll controller gestures", () => {
  test("paint lays a note a cell, following the pitch, or held on it with Alt", () => {
    const roll = create({
      defaultValue: [],
      drawStyle: "paint",
      maxPitch: 64,
      minPitch: 60,
      mode: "draw",
    });
    const grid = gridElement();
    roll.pressGrid(pointer("pointerdown", 5, 5), grid);
    document.dispatchEvent(pointer("pointermove", 15, 25));
    document.dispatchEvent(pointer("pointermove", 18, 25));
    document.dispatchEvent(pointer("pointermove", 25, 45, { altKey: true }));
    document.dispatchEvent(pointer("pointerup", 25, 45));
    const { notes } = roll.getSnapshot();
    expect(notes.map((note) => [note.start, note.pitch, note.length])).toEqual([
      [0, 64, 1],
      [1, 62, 1],
      [2, 64, 1],
    ]);
    expect(roll.getSnapshot().selection.size).toBe(3);
  });

  test("a stretch handle stretches the selection from its other edge", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const roll = create({ defaultSelection: ["a", "b"], onValueCommitted });
    const grid = gridElement();
    roll.pressStretch("end", pointer("pointerdown", 30, 0), grid, grid);
    document.dispatchEvent(pointer("pointermove", 60, 0));
    document.dispatchEvent(pointer("pointerup", 60, 0));
    expect(
      roll.getSnapshot().notes.map((note) => [note.start, note.length])
    ).toEqual([
      [0, 2],
      [4, 2],
    ]);
    expect(onValueCommitted.mock.calls[0]?.[1]).toMatchObject({
      edit: "stretch",
    });
  });

  test("a chance bar drags the chance, and Cmd on a velocity bar its deviation", () => {
    const roll = create({ defaultSelection: ["a"] });
    const lane = gridElement();
    roll.pressVelocity(
      "a",
      pointer("pointerdown", 0, 40),
      lane,
      lane,
      "chance"
    );
    document.dispatchEvent(pointer("pointermove", 0, 65));
    document.dispatchEvent(pointer("pointerup", 0, 65));
    expect(roll.getSnapshot().notes[0]?.chance).toBeCloseTo(0.5, 5);
    expect(roll.getSnapshot().notes[0]?.velocity).toBe(0.5);
    roll.pressVelocity(
      "a",
      pointer("pointerdown", 0, 40, { metaKey: true }),
      lane,
      lane
    );
    document.dispatchEvent(pointer("pointermove", 0, 30));
    document.dispatchEvent(pointer("pointerup", 0, 30));
    expect(roll.getSnapshot().notes[0]?.deviation).toBeCloseTo(0.2, 5);
    expect(roll.getSnapshot().notes[0]?.velocity).toBe(0.5);
  });

  test("the arrow keys change a chance", () => {
    const roll = create();
    expect(roll.keyVelocity("a", key("ArrowDown"), "chance")).toBe(true);
    expect(roll.getSnapshot().notes[0]?.chance).toBeCloseTo(0.95, 5);
  });
});

describe("Piano roll controller velocity brush", () => {
  test("in draw mode a drag paints each bar under the pointer to its height", () => {
    const roll = create({ mode: "draw" });
    const lane = gridElement();
    roll.paintLevels(pointer("pointerdown", 5, 10), lane);
    document.dispatchEvent(pointer("pointermove", 25, 40));
    document.dispatchEvent(pointer("pointerup", 25, 40));
    const [a, b] = roll.getSnapshot().notes;
    expect(a?.velocity).toBeCloseTo(0.8, 5);
    expect(b?.velocity).toBeCloseTo(0.2, 5);
  });

  test("does nothing in select mode", () => {
    const roll = create();
    const lane = gridElement();
    roll.paintLevels(pointer("pointerdown", 5, 10), lane, "chance");
    document.dispatchEvent(pointer("pointerup", 5, 10));
    expect(roll.getSnapshot().notes[0]?.chance).toBeUndefined();
  });
});
