import { mock } from "bun:test";
import { fireEvent, type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers.ts";
import { PianoRoll } from "../../../entries/piano-roll.ts";
import { Timeline } from "../../../entries/timeline.ts";

type Note = PianoRoll.Root.Note;

/** C4 (60) to D#4 (63): four rows, the top one D#4. */
export const NOTES: Note[] = [
  { id: "a", length: 2, pitch: 60, start: 0, velocity: 1 },
  { id: "b", length: 4, pitch: 62, start: 4, velocity: 0.5 },
];

/**
 * A roll on a 16-unit timeline with a grid every unit, its grid 160×40 at
 * the origin: 10px per unit across, 10px per row down. Extra props go to the
 * roll, `timelineProps` to the timeline.
 */
export function renderRoll(
  props: PianoRoll.Root.Props = {},
  timelineProps: Timeline.Root.Props = {}
) {
  const onValueChange = mock(
    (_value: Note[], _details: PianoRoll.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: Note[], _details: PianoRoll.Root.CommitEventDetails) => undefined
  );
  const onSelectionChange = mock(
    (
      _ids: readonly PianoRoll.Root.NoteId[],
      _details: PianoRoll.Root.SelectionChangeEventDetails
    ) => undefined
  );
  const onNoteOn = mock(
    (_pitch: number, _details: PianoRoll.Root.NoteOnEventDetails) => undefined
  );
  const onNoteOff = mock(
    (_pitch: number, _details: PianoRoll.Root.NoteOffEventDetails) => undefined
  );
  const view: RenderResult = render(
    <Timeline.Root duration={16} snapStep={1} {...timelineProps}>
      <PianoRoll.Root
        data-testid="root"
        defaultValue={NOTES}
        maxPitch={63}
        minPitch={60}
        onNoteOff={onNoteOff}
        onNoteOn={onNoteOn}
        onSelectionChange={onSelectionChange}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        {...props}
      >
        <PianoRoll.Keys aria-label="Keys" data-testid="keys">
          <PianoRoll.Rows>
            {(pitch) => (
              <PianoRoll.Key
                data-testid={`key-${pitch}`}
                key={pitch}
                pitch={pitch}
              />
            )}
          </PianoRoll.Rows>
        </PianoRoll.Keys>
        <PianoRoll.Grid aria-label="Notes" data-testid="grid">
          <PianoRoll.Rows>
            {(pitch) => (
              <PianoRoll.Row
                data-testid={`row-${pitch}`}
                key={pitch}
                pitch={pitch}
              />
            )}
          </PianoRoll.Rows>
          <PianoRoll.Notes>
            {(note) => (
              <PianoRoll.Note
                data-testid={`note-${note.id}`}
                key={note.id}
                note={note}
              >
                <PianoRoll.NoteHandle
                  data-testid={`start-${note.id}`}
                  edge="start"
                />
                <PianoRoll.NoteHandle
                  data-testid={`end-${note.id}`}
                  edge="end"
                />
              </PianoRoll.Note>
            )}
          </PianoRoll.Notes>
          <PianoRoll.Marquee data-testid="marquee" />
          <PianoRoll.SelectionSpan data-testid="span" />
        </PianoRoll.Grid>
        <PianoRoll.VelocityLane aria-label="Velocity" data-testid="velocities">
          <PianoRoll.Notes>
            {(note) => (
              <PianoRoll.Velocity
                data-testid={`velocity-${note.id}`}
                key={note.id}
                note={note}
              />
            )}
          </PianoRoll.Notes>
        </PianoRoll.VelocityLane>
      </PianoRoll.Root>
    </Timeline.Root>
  );
  const grid = view.getByTestId("grid");
  mockRect(grid, { bottom: 40, height: 40, right: 160, width: 160 });
  mockRect(view.getByTestId("velocities"), {
    bottom: 100,
    height: 50,
    right: 160,
    top: 50,
    width: 160,
  });
  const keys = view.getByTestId("keys");
  mockRect(keys, { bottom: 40, height: 40, right: 40, width: 40 });
  return {
    grid,
    keys,
    note: (id: string) => view.getByTestId(`note-${id}`),
    onNoteOff,
    onNoteOn,
    onSelectionChange,
    onValueChange,
    onValueCommitted,
    root: view.getByTestId("root"),
    velocity: (id: string) => view.getByTestId(`velocity-${id}`),
    view,
  };
}

/** A pointer pressed at (x, y) on `element`, moved to each point, released at the last. */
export function drag(
  element: Element,
  from: readonly [number, number],
  to: readonly [number, number],
  init: { altKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}
) {
  fireEvent.pointerDown(element, {
    button: 0,
    clientX: from[0],
    clientY: from[1],
    pointerId: 1,
    ...init,
  });
  fireEvent.pointerMove(element, {
    clientX: to[0],
    clientY: to[1],
    pointerId: 1,
    ...init,
  });
  fireEvent.pointerUp(element, {
    clientX: to[0],
    clientY: to[1],
    pointerId: 1,
    ...init,
  });
}

/** The notes the roll last reported, by id. */
export function notesById(notes: readonly Note[]) {
  return Object.fromEntries(notes.map((note) => [note.id, note]));
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
