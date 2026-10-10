import type * as React from "react";
import { usePianoRollContext } from "../context";
import { type Note, spatialOrder } from "../internal/edits";

/**
 * Renders `children` once per note, in the order they are read: by start,
 * then from the highest pitch down. That order is also the tab order.
 * Renders no element of its own.
 */
export function Notes({ children }: Notes.Props) {
  const { meta } = usePianoRollContext("Notes");
  return <>{spatialOrder(meta.notes).map((note) => children(note))}</>;
}

export namespace Notes {
  export interface Props {
    children: (note: Note) => React.ReactNode;
  }
}
