import * as React from "react";
import { Root as PianoRoot } from "../../piano/elements/root.js";
import { usePianoRollContext, useRollView } from "../context.js";

/**
 * The keyboard down the side of the roll: a `Piano` laid out on the roll's
 * rows, low end at the bottom. Pressing a key sounds it through the roll's
 * `onNoteOn`; with Shift, pressing it (or Shift + Enter) selects every note on
 * its row, or deselects them when they all are. Put a `PianoRoll.Key` per row
 * inside, with `PianoRoll.Rows`. Renders a `<div>` element.
 */
export function Keys(componentProps: Keys.Props) {
  const { disabled = false, ...elementProps } = componentProps;
  const { controller, rows, state } = usePianoRollContext("Keys");
  const active = useRollView("Keys", (view) => view.active);
  const activeNotes = React.useMemo(() => [...active], [active]);
  const handleNoteOn = React.useCallback(
    (pitch: number, eventDetails: PianoRoot.NoteOnEventDetails) =>
      controller.keyOn(pitch, eventDetails),
    [controller]
  );
  return (
    <PianoRoot
      {...elementProps}
      activeNotes={activeNotes}
      disabled={disabled || state.disabled}
      layout="even"
      onNoteOff={controller.keyOff}
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
