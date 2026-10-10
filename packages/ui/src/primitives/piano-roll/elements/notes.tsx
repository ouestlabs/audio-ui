import * as React from "react";
import { usePianoRollContext, useRollView } from "../context";
import { type Note, type NoteId, spatialOrder } from "../internal/edits";

/**
 * Renders `children` once per note, in the order they are read: by start,
 * then from the highest pitch down. That order is also the tab order.
 * Renders no element of its own.
 */
export function Notes({ children }: Notes.Props) {
  const notes = useRollView("Notes", (view) => view.notes);
  const { editing } = usePianoRollContext("Notes").state;
  // A note moved past another keeps its place in the DOM while it is dragged:
  // reordering the elements would drop the pointer's capture and end the
  // drag. They fall into reading order when the gesture ends.
  const frozen = React.useRef<readonly NoteId[] | null>(null);
  let ordered = spatialOrder(notes);
  if (editing) {
    frozen.current ??= ordered.map((note) => note.id);
    const known = new Map(notes.map((note) => [note.id, note]));
    const kept = frozen.current.flatMap((id) => known.get(id) ?? []);
    const added = ordered.filter((note) => !frozen.current?.includes(note.id));
    ordered = [...kept, ...added];
  } else {
    frozen.current = null;
  }
  return (
    <>
      {ordered.map((note) => (
        <Slot key={note.id} note={note} render={children} />
      ))}
    </>
  );
}

/** One note's place: it renders again only when its note, or `children`, changes. */
const Slot = React.memo(function NoteSlot({
  render,
  note,
}: {
  note: Note;
  render: Notes.Props["children"];
}) {
  return <>{render(note)}</>;
});

export namespace Notes {
  export interface Props {
    children: (note: Note) => React.ReactNode;
  }
}
