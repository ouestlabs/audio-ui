import * as React from "react";
import { useRollView } from "../context";
import { type Note, spatialOrder } from "../internal/edits";

/**
 * Renders `children` once per note, in the order they are read: by start,
 * then from the highest pitch down. That order is also the tab order.
 * Renders no element of its own.
 */
export function Notes({ children }: Notes.Props) {
  const notes = useRollView("Notes", (view) => view.notes);
  return (
    <>
      {spatialOrder(notes).map((note) => (
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
