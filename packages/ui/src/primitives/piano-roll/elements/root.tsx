import { pitchName } from "@audio-ui/core";
import {
  createPianoRollController,
  type Note,
  type NoteId,
  type PianoRollOptions,
  type Rows,
} from "@audio-ui/core/piano-roll";
import * as React from "react";
import { shallowEqual } from "../../internal/equal.js";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { TimelineContext } from "../../timeline/context.js";
import {
  PianoRollContext,
  type PianoRollContextValue,
  type PianoRollState,
  ROWS_PROPERTY,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
} from "../context.js";

const formatPosition = (value: number) => String(Math.round(value * 100) / 100);

const describeNote = (note: Note) =>
  `${pitchName(note.pitch)}, ${formatPosition(note.start)} to ${formatPosition(note.start + note.length)}`;

/**
 * Groups the parts of a piano roll and owns its notes, its selection and the
 * pitches it draws. It sits inside a `Timeline.Root`, which gives it its
 * length, zoom, grid and position: a note starts and lasts in the timeline's
 * units, and every gesture lands on its grid unless Cmd/Ctrl is held.
 *
 * Rows run from `maxPitch` at the top to `minPitch`, or with `folded` only
 * the pitches carrying notes have one. Its `--piano-roll-rows` CSS variable
 * is how many rows there are, so the grid and the keys can be given a height
 * per row. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    activePitches,
    className,
    createNoteId,
    defaultSelection,
    defaultValue,
    disabled: disabledProp = false,
    folded = false,
    getNoteLabel = describeNote,
    maxPitch = 72,
    minLength,
    minPitch = 48,
    mode = "select",
    onNoteOff,
    onNoteOn,
    onSelectionChange,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    selection,
    style,
    value,
    ...elementProps
  } = componentProps;
  const timeline = React.use(TimelineContext);
  if (!timeline) {
    throw new Error("PianoRoll.Root must be used within Timeline.Root");
  }
  const { duration, grid, position, step, zoom } = timeline.meta;
  const disabled = disabledProp || timeline.state.disabled;

  // Focus that has to wait for the notes to render: a note just added, or
  // where focus goes once the focused note is removed.
  const noteElementsRef = React.useRef(new Map<NoteId, HTMLElement>());
  const pendingFocusRef = React.useRef<{ target: NoteId | null } | null>(null);
  const [, setFocusRequest] = React.useState(0);
  const focusAfterRender = React.useCallback((target: NoteId | null) => {
    pendingFocusRef.current = { target };
    setFocusRequest((count) => count + 1);
  }, []);
  const gridRef = React.useRef<HTMLElement | null>(null);

  const options: PianoRollOptions = {
    activePitches,
    createNoteId,
    defaultSelection,
    defaultValue,
    disabled,
    folded,
    maxPitch,
    minLength,
    minPitch,
    mode,
    onNoteOff,
    onNoteOn,
    onSelectionChange,
    onValueChange,
    onValueCommitted,
    requestFocus: focusAfterRender,
    selection,
    timeline: {
      duration,
      grid,
      position: () => position.get(),
      step,
      zoom,
    },
    value,
  };
  const [controller] = React.useState(() => createPianoRollController(options));
  // Set on every render, so the roll always reads the latest props.
  controller.setOptions(options);

  // The roll's own state and rows: Root re-renders on these, and not on each
  // edit, which only the parts showing the edited notes render for.
  const lastState = React.useRef<PianoRollState | null>(null);
  const readState = React.useCallback(() => {
    const view = controller.getSnapshot();
    const next: PianoRollState = {
      disabled: view.disabled,
      editing: view.editing,
      folded: view.folded,
      mode: view.mode,
    };
    if (lastState.current && shallowEqual(lastState.current, next)) {
      return lastState.current;
    }
    lastState.current = next;
    return next;
  }, [controller]);
  const rollState = React.useSyncExternalStore(
    controller.subscribe,
    readState,
    readState
  );
  const readRows = React.useCallback(
    () => controller.getSnapshot().rows,
    [controller]
  );
  const rows: Rows = React.useSyncExternalStore(
    controller.subscribe,
    readRows,
    readRows
  );

  // After every render: cheap, and whatever rendered the note is done.
  React.useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) {
      return;
    }
    const element =
      pending.target === null
        ? gridRef.current
        : noteElementsRef.current.get(pending.target);
    // A note not mounted yet takes the focus as it registers.
    if (element) {
      pendingFocusRef.current = null;
      element.focus({ preventScroll: true });
    }
  });

  const registerNote = React.useCallback(
    (id: NoteId, node: HTMLElement | null) => {
      if (node) {
        noteElementsRef.current.set(id, node);
        // A note added by the edit that asked for focus mounts after the
        // roll's own render.
        if (pendingFocusRef.current?.target === id) {
          pendingFocusRef.current = null;
          node.focus({ preventScroll: true });
        }
      } else {
        noteElementsRef.current.delete(id);
      }
    },
    []
  );

  const context = React.useMemo<PianoRollContextValue>(
    () => ({
      controller,
      focusAfterRender,
      getNoteLabel,
      gridRef,
      registerNote,
      rows,
      state: rollState,
    }),
    [controller, focusAfterRender, getNoteLabel, registerNote, rollState, rows]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { [ROWS_PROPERTY as string]: rows.pitches.length } },
      { ...elementProps, ...resolveStyling(className, style, rollState) }
    ),
    ref,
    render,
    state: rollState,
  });

  return <PianoRollContext value={context}>{element}</PianoRollContext>;
}

export namespace Root {
  export type State = PianoRollState;
  export type Note = import("@audio-ui/core/piano-roll").Note;
  export type NoteId = import("@audio-ui/core/piano-roll").NoteId;
  export type Edit = import("../context.js").Edit;
  export type Band = import("../context.js").Band;
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = ValueChangeEventDetails;
  export type CommitEventDetails = ValueCommitEventDetails;
  export type SelectionChangeEventDetails =
    import("../context.js").SelectionChangeEventDetails;
  export type NoteOnEventDetails = import("../context.js").NoteOnEventDetails;
  export type NoteOffEventDetails = import("../context.js").NoteOffEventDetails;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Pitches lit from elsewhere, such as a MIDI input or the notes playing, on the keys and rows. */
    activePitches?: readonly number[];
    /** Returns the id of a note drawn, added or duplicated. Defaults to `"note-<n>"`, skipping ids in use. */
    createNoteId?: () => NoteId;
    /** Uncontrolled starting selection. */
    defaultSelection?: readonly NoteId[];
    /** Uncontrolled starting notes. */
    defaultValue?: readonly Note[];
    disabled?: boolean;
    /** Whether only the pitches carrying notes get a row. A roll without notes keeps them all. @default false */
    folded?: boolean;
    /** Returns a note's accessible name. Defaults to its pitch and where it starts and ends, such as "C4, 4 to 6". */
    getNoteLabel?: (note: Note) => string;
    /** Highest MIDI pitch, inclusive. @default 72 */
    maxPitch?: number;
    /** The shortest a note can be, in the timeline's units. Defaults to the timeline's grid step. */
    minLength?: number;
    /** Lowest MIDI pitch, inclusive: 60 is middle C. @default 48 */
    minPitch?: number;
    /** What a press on empty grid does: draw a note, or start a selection rectangle (a double-click draws). @default "select" */
    mode?: "draw" | "select";
    /** Fires when a pitch stops sounding. */
    onNoteOff?: (pitch: number, eventDetails: NoteOffEventDetails) => void;
    /** Fires when a pitch should sound: a key pressed, a note drawn, picked up or moved to a new pitch. `eventDetails.cancel()` keeps it silent. */
    onNoteOn?: (pitch: number, eventDetails: NoteOnEventDetails) => void;
    /** Fires when notes are selected or deselected. */
    onSelectionChange?: (
      selection: readonly NoteId[],
      eventDetails: SelectionChangeEventDetails
    ) => void;
    /** Fires while notes are drawn, moved, resized, duplicated or removed. */
    onValueChange?: (
      value: Note[],
      eventDetails: ValueChangeEventDetails
    ) => void;
    /** Fires when a gesture that changed the notes ends, and after each edit from the keyboard. */
    onValueCommitted?: (
      value: Note[],
      eventDetails: ValueCommitEventDetails
    ) => void;
    /** The ids of the selected notes. */
    selection?: readonly NoteId[];
    /** The notes. */
    value?: readonly Note[];
  }
}
