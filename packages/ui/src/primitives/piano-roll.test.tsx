import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { PianoRoll } from "../piano-roll";

/** 1 note, 4-step timeline, 4-semitone range (60-63), so paint/keyboard/drag assertions stay exact. */
const TEST_NOTES: PianoRoll.Note[] = [
  { duration: 1, id: "a", note: 61, startStep: 1, velocity: 1 },
];

function renderPianoRoll(props: Partial<PianoRoll.RootProps> = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <PianoRoll.Root
      defaultValue={TEST_NOTES}
      endNote={63}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      startNote={60}
      totalSteps={4}
      {...props}
    >
      <PianoRoll.Grid data-testid="grid">
        <PianoRoll.Notes>
          {(note) => (
            <PianoRoll.Note
              data-testid={`note-${note.id}`}
              id={note.id}
              key={note.id}
            >
              <PianoRoll.NoteHandle
                data-testid={`start-handle-${note.id}`}
                side="start"
              />
              <PianoRoll.NoteHandle data-testid={`end-handle-${note.id}`} />
            </PianoRoll.Note>
          )}
        </PianoRoll.Notes>
      </PianoRoll.Grid>
    </PianoRoll.Root>
  );
  return {
    grid: view.getByTestId("grid"),
    notes: view.getAllByRole("gridcell"),
    onValueChange,
    onValueCommit,
    view,
  };
}

describe("PianoRoll value semantics", () => {
  test("renders one gridcell per note with grid and gridcell semantics", () => {
    const { grid, notes } = renderPianoRoll();
    expect(grid.getAttribute("role")).toBe("grid");
    expect(grid.getAttribute("aria-colcount")).toBe("4");
    expect(grid.getAttribute("aria-rowcount")).toBe("4");
    expect(grid.getAttribute("aria-multiselectable")).toBe("true");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.getAttribute("aria-colindex")).toBe("2");
    expect(notes[0]?.getAttribute("aria-rowindex")).toBe("3");
    expect(notes[0]?.getAttribute("aria-colspan")).toBe("1");
  });

  test("matrix shape follows the controlled value", () => {
    const { notes } = renderPianoRoll({
      value: [
        { duration: 1, id: "a", note: 60, startStep: 0 },
        { duration: 2, id: "b", note: 62, startStep: 1 },
      ],
    });
    expect(notes).toHaveLength(2);
  });

  test("renders (and thus tab-orders) notes by spatial position, not array/insertion order", () => {
    const { notes } = renderPianoRoll({
      value: [
        { duration: 1, id: "late", note: 60, startStep: 3 },
        { duration: 1, id: "early", note: 60, startStep: 0 },
        { duration: 1, id: "middle", note: 60, startStep: 1 },
      ],
    });
    expect(notes.map((n) => n.dataset.testid)).toEqual([
      "note-early",
      "note-middle",
      "note-late",
    ]);
  });
});

describe("PianoRoll pointer add/remove (grid 200×100, 4 steps × 4 notes)", () => {
  test("clicking empty grid space (pointerdown/up with no movement) adds a 1-step note", () => {
    const { grid, onValueCommit } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });

    fireEvent.pointerDown(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: 125, clientY: 25, pointerId: 1 });

    expect(onValueCommit).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 1, note: 63, startStep: 2 }),
    ]);
  });

  test("dragging from empty grid space paints a note spanning the dragged steps", () => {
    const { grid, onValueChange, onValueCommit } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });

    fireEvent.pointerDown(grid, { clientX: 25, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 3, note: 63, startStep: 0 }),
    ]);

    fireEvent.pointerUp(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 3, note: 63, startStep: 0 }),
    ]);
  });

  test("painting past the anchor in either direction extends the note both ways", () => {
    const { grid, onValueChange } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });

    // anchor at step 2 (x=125), drag left to step 0 (x=25)
    fireEvent.pointerDown(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: 25, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 3, note: 63, startStep: 0 }),
    ]);
  });

  test("a sub-threshold move after pointerdown never starts a paint drag", () => {
    const { grid, onValueChange, onValueCommit } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });

    fireEvent.pointerDown(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    onValueChange.mockClear();
    fireEvent.pointerMove(grid, { clientX: 126, clientY: 25, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(grid, { clientX: 126, clientY: 25, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 1, note: 63, startStep: 2 }),
    ]);
  });

  test("double-clicking a note removes it", () => {
    const { notes, onValueCommit } = renderPianoRoll();
    fireEvent.doubleClick(notes[0] as HTMLElement);
    expect(onValueCommit).toHaveBeenLastCalledWith([]);
  });

  test("ignores pointer input when disabled", () => {
    const { grid, onValueCommit } = renderPianoRoll({ disabled: true });
    mockRect(grid, { height: 100, width: 200 });
    fireEvent.pointerDown(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: 125, clientY: 25, pointerId: 1 });
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});

describe("PianoRoll keyboard", () => {
  test("Enter on the grid adds a note at the default position", () => {
    const { grid, onValueCommit } = renderPianoRoll();
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 1, note: 62, startStep: 0 }),
    ]);
  });

  test("ArrowRight/ArrowLeft move the focused note by one step", () => {
    const { notes, onValueCommit } = renderPianoRoll();
    fireEvent.keyDown(notes[0] as HTMLElement, { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ startStep: 2 }),
    ]);
    fireEvent.keyDown(notes[0] as HTMLElement, { key: "ArrowLeft" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ startStep: 1 }),
    ]);
  });

  test("ArrowUp/ArrowDown move the focused note by one semitone", () => {
    const { notes, onValueCommit } = renderPianoRoll();
    fireEvent.keyDown(notes[0] as HTMLElement, { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ note: 62 }),
    ]);
  });

  test("Shift+ArrowRight extends duration, Shift+ArrowLeft shrinks it (floored at minDuration)", () => {
    const { notes, onValueCommit } = renderPianoRoll();
    fireEvent.keyDown(notes[0] as HTMLElement, {
      key: "ArrowRight",
      shiftKey: true,
    });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration: 2 }),
    ]);
    fireEvent.keyDown(notes[0] as HTMLElement, {
      key: "ArrowLeft",
      shiftKey: true,
    });
    fireEvent.keyDown(notes[0] as HTMLElement, {
      key: "ArrowLeft",
      shiftKey: true,
    });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration: 1 }),
    ]);
  });

  test("Delete removes the focused note", () => {
    const { notes, onValueCommit } = renderPianoRoll();
    fireEvent.keyDown(notes[0] as HTMLElement, { key: "Delete" });
    expect(onValueCommit).toHaveBeenLastCalledWith([]);
  });

  test("ignores keys when disabled", () => {
    const { notes, onValueCommit } = renderPianoRoll({ disabled: true });
    fireEvent.keyDown(notes[0] as HTMLElement, { key: "ArrowRight" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(notes[0]?.tabIndex).toBe(-1);
  });
});

describe("PianoRoll pointer drag (grid 200×100, 4 steps × 4 notes)", () => {
  test("dragging a note moves it, streaming onValueChange and committing on release", () => {
    const { grid, notes, onValueChange, onValueCommit } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });
    const note = notes[0] as HTMLElement;

    fireEvent.pointerDown(note, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(note, { clientX: 150, clientY: 50, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ note: 61, startStep: 2 }),
    ]);

    fireEvent.pointerUp(note, { clientX: 150, clientY: 50, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ note: 61, startStep: 2 }),
    ]);
  });

  test("a sub-threshold move after pressing a note never starts a move drag, so releasing just leaves it selected", () => {
    const { grid, notes, onValueChange, onValueCommit } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });
    const note = notes[0] as HTMLElement;

    fireEvent.pointerDown(note, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(note, { clientX: 102, clientY: 50, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(note, { clientX: 102, clientY: 50, pointerId: 1 });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(note.getAttribute("aria-selected")).toBe("true");
  });

  test("dragging a note's end handle resizes it without moving its start", () => {
    const { grid, onValueChange, onValueCommit, view } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });
    const handle = view.getByTestId("end-handle-a");

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, clientY: 50, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration: 2, startStep: 1 }),
    ]);

    fireEvent.pointerUp(handle, { clientX: 150, clientY: 50, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration: 2, startStep: 1 }),
    ]);
  });

  test("dragging a note's start handle trims from the front without moving its end", () => {
    const { grid, onValueChange, onValueCommit, view } = renderPianoRoll({
      value: [{ duration: 2, id: "a", note: 61, startStep: 1 }],
    });
    mockRect(grid, { height: 100, width: 200 });
    const handle = view.getByTestId("start-handle-a");

    // note "a" spans startStep 1-2 (end=3); dragging its start handle left by
    // one step should extend startStep to 0 while duration grows to 3, so the
    // end (startStep + duration) stays fixed at 3.
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration: 3, startStep: 0 }),
    ]);

    fireEvent.pointerUp(handle, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration: 3, startStep: 0 }),
    ]);
  });

  test("a sub-threshold move after pressing a resize handle never starts a resize drag", () => {
    const { grid, onValueChange, onValueCommit, view } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });
    const handle = view.getByTestId("end-handle-a");

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 103, clientY: 50, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { clientX: 103, clientY: 50, pointerId: 1 });
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  test("ignores pointer drag when disabled", () => {
    const { grid, notes, onValueChange } = renderPianoRoll({
      disabled: true,
    });
    mockRect(grid, { height: 100, width: 200 });
    const note = notes[0] as HTMLElement;

    fireEvent.pointerDown(note, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(note, { clientX: 150, clientY: 50, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("PianoRoll Alt/Option+drag duplicate (grid 200×100, 4 steps × 4 notes)", () => {
  test("duplicates the note and drags the copy, leaving the original in place", () => {
    const { grid, notes, onValueCommit } = renderPianoRoll();
    mockRect(grid, { height: 100, width: 200 });
    const note = notes[0] as HTMLElement;

    fireEvent.pointerDown(note, {
      altKey: true,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(note, {
      altKey: true,
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerUp(note, {
      altKey: true,
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    });

    expect(onValueCommit).toHaveBeenLastCalledWith([
      TEST_NOTES[0],
      expect.objectContaining({ duration: 1, note: 61, startStep: 2 }),
    ]);
  });

  test("duplicates the whole selection when dragging a selected note", () => {
    const { grid, notes, onValueCommit } = renderPianoRoll({
      value: [
        { duration: 1, id: "a", note: 61, startStep: 0 },
        { duration: 1, id: "b", note: 62, startStep: 2 },
      ],
    });
    mockRect(grid, { height: 100, width: 200 });

    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 2,
      shiftKey: true,
    });
    fireEvent.pointerDown(notes[1] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 3,
      shiftKey: true,
    });

    fireEvent.pointerDown(notes[1] as HTMLElement, {
      altKey: true,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(notes[1] as HTMLElement, {
      altKey: true,
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerUp(notes[1] as HTMLElement, {
      altKey: true,
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    });

    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a", note: 61, startStep: 0 }),
      expect.objectContaining({ id: "b", note: 62, startStep: 2 }),
      expect.objectContaining({ note: 61, startStep: 1 }),
      expect.objectContaining({ note: 62, startStep: 3 }),
    ]);
  });
});

describe("PianoRoll.Keys/Key", () => {
  test("renders one key per semitone in range, aligned with the note grid's rows", () => {
    const view = render(
      <PianoRoll.Root endNote={63} startNote={60} totalSteps={4}>
        <PianoRoll.Grid>
          <PianoRoll.Keys>
            {(note, color) => (
              <PianoRoll.Key
                data-color={color}
                data-testid={`key-${note}`}
                key={note}
                note={note}
              />
            )}
          </PianoRoll.Keys>
        </PianoRoll.Grid>
      </PianoRoll.Root>
    );

    expect(view.getByTestId("key-60").getAttribute("data-color")).toBe("white");
    expect(view.getByTestId("key-61").getAttribute("data-color")).toBe("black");
    // Same bottom/height formula as Note: 4-note range, key 60 is the lowest row.
    expect(view.getByTestId("key-60").style.bottom).toBe("0%");
    expect(view.getByTestId("key-60").style.height).toBe("25%");
    expect(view.getByTestId("key-63").style.bottom).toBe("75%");
  });
});

describe("PianoRoll.KeysTrack: glissando + active highlighting (strip 40×100, 4 rows)", () => {
  function renderKeysTrack(props: Partial<PianoRoll.RootProps> = {}) {
    const onKeyNoteOff = mock(() => undefined);
    const onKeyNoteOn = mock(() => undefined);
    const view = render(
      <PianoRoll.Root
        endNote={63}
        onKeyNoteOff={onKeyNoteOff}
        onKeyNoteOn={onKeyNoteOn}
        startNote={60}
        totalSteps={4}
        {...props}
      >
        <PianoRoll.KeysTrack data-testid="keys-track">
          <PianoRoll.Keys>
            {(note) => (
              <PianoRoll.Key
                data-testid={`key-${note}`}
                key={note}
                note={note}
              />
            )}
          </PianoRoll.Keys>
        </PianoRoll.KeysTrack>
      </PianoRoll.Root>
    );
    return {
      onKeyNoteOff,
      onKeyNoteOn,
      track: view.getByTestId("keys-track"),
      view,
    };
  }

  test("dragging across the strip retriggers each key it passes over", () => {
    const { onKeyNoteOff, onKeyNoteOn, track, view } = renderKeysTrack();
    mockRect(track, { height: 100, width: 40 });

    fireEvent.pointerDown(track, { clientX: 20, clientY: 87, pointerId: 1 });
    expect(onKeyNoteOn).toHaveBeenLastCalledWith(60);
    expect(view.getByTestId("key-60").getAttribute("data-active")).toBe("true");

    fireEvent.pointerMove(track, { clientX: 20, clientY: 12, pointerId: 1 });
    expect(onKeyNoteOff).toHaveBeenLastCalledWith(60);
    expect(onKeyNoteOn).toHaveBeenLastCalledWith(63);
    expect(view.getByTestId("key-60").getAttribute("data-active")).toBe(
      "false"
    );
    expect(view.getByTestId("key-63").getAttribute("data-active")).toBe("true");

    fireEvent.pointerUp(track, { clientX: 20, clientY: 12, pointerId: 1 });
    expect(onKeyNoteOff).toHaveBeenLastCalledWith(63);
  });

  test("activeNotes overlays external highlights alongside pointer presses", () => {
    const { view } = renderKeysTrack({ activeNotes: [62] });
    expect(view.getByTestId("key-62").getAttribute("data-active")).toBe("true");
    expect(view.getByTestId("key-60").getAttribute("data-active")).toBe(
      "false"
    );
  });
});

describe("PianoRoll multi-select (grid 200×100, 4 steps × 4 notes)", () => {
  const TWO_NOTES: PianoRoll.Note[] = [
    { duration: 1, id: "a", note: 61, startStep: 0 },
    { duration: 1, id: "b", note: 62, startStep: 2 },
  ];

  test("shift-click toggles a note into and out of the selection", () => {
    const { notes } = renderPianoRoll({ value: TWO_NOTES });
    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 2,
      shiftKey: true,
    });
    expect(notes[0]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 3,
      shiftKey: true,
    });
    expect(notes[0]?.getAttribute("aria-selected")).toBe("false");
  });

  test("dragging any selected note moves the whole group, clamped by its most-restrictive member", () => {
    const { grid, notes, onValueCommit } = renderPianoRoll({
      value: TWO_NOTES,
    });
    mockRect(grid, { height: 100, width: 200 });

    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 2,
      shiftKey: true,
    });
    fireEvent.pointerDown(notes[1] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 3,
      shiftKey: true,
    });

    fireEvent.pointerDown(notes[1] as HTMLElement, {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(notes[1] as HTMLElement, {
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerUp(notes[1] as HTMLElement, {
      clientX: 150,
      clientY: 50,
      pointerId: 1,
    });

    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a", startStep: 1 }),
      expect.objectContaining({ id: "b", startStep: 3 }),
    ]);
  });

  test("Delete removes every selected note", () => {
    const { notes, onValueCommit } = renderPianoRoll({ value: TWO_NOTES });

    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 2,
      shiftKey: true,
    });
    fireEvent.pointerDown(notes[1] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 3,
      shiftKey: true,
    });

    fireEvent.keyDown(notes[1] as HTMLElement, { key: "Delete" });
    expect(onValueCommit).toHaveBeenLastCalledWith([]);
  });

  test("double-click removes only the clicked note, leaving the rest of the selection intact", () => {
    const { notes, onValueCommit } = renderPianoRoll({ value: TWO_NOTES });

    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 2,
      shiftKey: true,
    });
    fireEvent.pointerDown(notes[1] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 3,
      shiftKey: true,
    });

    fireEvent.doubleClick(notes[1] as HTMLElement);
    expect(onValueCommit).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a" }),
    ]);
    expect(notes[0]?.getAttribute("aria-selected")).toBe("true");
  });

  test("clicking empty grid space clears the selection", () => {
    const { grid, notes } = renderPianoRoll({ value: TWO_NOTES });
    mockRect(grid, { height: 100, width: 200 });

    fireEvent.pointerDown(notes[0] as HTMLElement, {
      clientX: 0,
      clientY: 0,
      pointerId: 2,
      shiftKey: true,
    });
    expect(notes[0]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.pointerDown(grid, { clientX: 175, clientY: 75, pointerId: 3 });
    fireEvent.pointerUp(grid, { clientX: 175, clientY: 75, pointerId: 3 });
    expect(notes[0]?.getAttribute("aria-selected")).toBe("false");
  });
});
