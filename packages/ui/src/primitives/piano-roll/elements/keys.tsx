import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { Root as PianoRoot } from "../../piano/elements/root";
import {
  type SelectionChangeEventDetails,
  usePianoRollContext,
  useRollView,
} from "../context";

/**
 * The keyboard down the side of the roll: a `Piano` laid out on the roll's
 * rows, low end at the bottom. Pressing a key sounds it through the roll's
 * `onNoteOn`; with Shift, pressing it (or Shift + Enter) selects every note on
 * its row, or deselects them when they all are. Put a `PianoRoll.Key` per row
 * inside, with `PianoRoll.Rows`. Renders a `<div>` element.
 */
export function Keys(componentProps: Keys.Props) {
  const { disabled = false, ...elementProps } = componentProps;
  const { actions, meta, state } = usePianoRollContext("Keys");
  const { noteOff, noteOn, select } = actions;
  const { rows, selectionRef, valueRef } = meta;
  const active = useRollView("Keys", (view) => view.active);

  const handleNoteOn = React.useCallback(
    (pitch: number, eventDetails: PianoRoot.NoteOnEventDetails) => {
      if (!eventDetails.event.shiftKey) {
        noteOn(pitch, Object.assign(eventDetails, { velocity: 1 }));
        return;
      }
      eventDetails.cancel();
      if (eventDetails.reason === "glide") {
        return;
      }
      // Takes every note on the row, or gives them all back.
      const row = valueRef.current
        .filter((note) => note.pitch === pitch)
        .map((note) => note.id);
      if (row.length === 0) {
        return;
      }
      const selection = selectionRef.current;
      const all = row.every((id) => selection.has(id));
      select(
        all
          ? [...selection].filter((id) => !row.includes(id))
          : [...new Set([...selection, ...row])],
        createChangeEventDetails(
          eventDetails.reason,
          eventDetails.event
        ) as SelectionChangeEventDetails
      );
    },
    [noteOn, select, selectionRef, valueRef]
  );

  const activeNotes = React.useMemo(() => [...active], [active]);

  return (
    <PianoRoot
      {...elementProps}
      activeNotes={activeNotes}
      disabled={disabled || state.disabled}
      layout="even"
      onNoteOff={noteOff}
      onNoteOn={handleNoteOn}
      orientation="vertical"
      pitches={rows.pitches}
    />
  );
}

export namespace Keys {
  export type State = PianoRoot.State;
  export type Props = Omit<
    PianoRoot.Props,
    | "activeNotes"
    | "layout"
    | "maxPitch"
    | "minPitch"
    | "onNoteOff"
    | "onNoteOn"
    | "orientation"
    | "pitches"
  >;
}
