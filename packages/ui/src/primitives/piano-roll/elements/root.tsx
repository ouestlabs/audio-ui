import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { pitchName } from "../../internal/pitch";
import { createStore } from "../../internal/store";
import { TimelineContext } from "../../timeline/context";
import { snapToGrid } from "../../timeline/internal/snap";
import {
  type Band,
  type Edit,
  type NoteOffEventDetails,
  type NoteOnEventDetails,
  PianoRollContext,
  type PianoRollContextValue,
  type PianoRollState,
  ROWS_PROPERTY,
  type RollView,
  type SelectionChangeEventDetails,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
} from "../context";
import {
  cellStart,
  duplicateAfter,
  type Note,
  type NoteId,
  pasteNotes,
  quantizeNotes,
  type RollBounds,
  sameNotes,
  sanitizeNote,
} from "../internal/edits";
import { rollRows } from "../internal/rows";

const EMPTY: readonly Note[] = [];

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
    minLength: minLengthProp,
    minPitch = 48,
    mode = "select",
    onNoteOff,
    onNoteOn,
    onSelectionChange,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    selection: selectionProp,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;
  const timeline = React.use(TimelineContext);
  if (!timeline) {
    throw new Error("PianoRoll.Root must be used within Timeline.Root");
  }
  const { duration, grid, step, zoom } = timeline.meta;
  const disabled = disabledProp || timeline.state.disabled;
  const minLength = minLengthProp ?? (grid.step > 0 ? grid.step : step);
  const bounds = React.useMemo<RollBounds>(
    () => ({ duration, maxPitch, minLength, minPitch }),
    [duration, maxPitch, minLength, minPitch]
  );

  // Notes: props or state, kept on the roll.
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    readonly Note[]
  >(() => defaultValue ?? EMPTY);
  const rawValue = isControlled ? valueProp : uncontrolledValue;
  // A note keeps its sanitized object while it is the same note, so an edit
  // renders the notes it touches and not all of them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: new bounds sanitize every note again.
  const sanitized = React.useMemo(() => new WeakMap<Note, Note>(), [bounds]);
  const value = React.useMemo(
    () =>
      rawValue.map((note) => {
        const known = sanitized.get(note);
        if (known) {
          return known;
        }
        const next = sanitizeNote(note, bounds);
        sanitized.set(note, next);
        return next;
      }),
    [bounds, rawValue, sanitized]
  );

  // While a gesture edits the notes, they follow the pointer even if a
  // controlled value lags behind; when it ends the controlled value rules.
  const [editing, setEditingState] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<readonly Note[] | null>(
    null
  );
  const editingRef = React.useRef(false);
  const notes = dragValue ?? value;
  const valueRef = React.useRef(notes);
  valueRef.current = notes;

  const setEditing = React.useCallback((next: boolean) => {
    editingRef.current = next;
    setEditingState(next);
    if (!next) {
      setDragValue(null);
    }
  }, []);

  const change = React.useCallback(
    (next: Note[], eventDetails: ValueChangeEventDetails) => {
      if (sameNotes(next, valueRef.current)) {
        return false;
      }
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      valueRef.current = next;
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (isControlled && editingRef.current) {
        setDragValue(next);
      }
      return true;
    },
    [isControlled, onValueChange]
  );

  const commit = React.useCallback(
    (committed: Note[], eventDetails: ValueCommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  // Selection: props or state.
  const isSelectionControlled = selectionProp !== undefined;
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<
    readonly NoteId[]
  >(() => defaultSelection ?? []);
  const selectionList = isSelectionControlled
    ? selectionProp
    : uncontrolledSelection;
  const selection = React.useMemo(
    () => new Set(selectionList),
    [selectionList]
  );
  const selectionRef = React.useRef<ReadonlySet<NoteId>>(selection);
  selectionRef.current = selection;

  const select = React.useCallback(
    (ids: readonly NoteId[], eventDetails: SelectionChangeEventDetails) => {
      const { current } = selectionRef;
      if (ids.length === current.size && ids.every((id) => current.has(id))) {
        return false;
      }
      onSelectionChange?.(ids, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      selectionRef.current = new Set(ids);
      if (!isSelectionControlled) {
        setUncontrolledSelection(ids);
      }
      return true;
    },
    [isSelectionControlled, onSelectionChange]
  );

  // Auditioning: what sounds, and what lights the keys and rows.
  const [sounding, setSounding] = React.useState<ReadonlySet<number>>(
    () => new Set()
  );
  const active = React.useMemo(
    () => new Set([...sounding, ...(activePitches ?? [])]),
    [activePitches, sounding]
  );
  const lastPitchRef = React.useRef<number | null>(null);

  const noteOn = React.useCallback(
    (pitch: number, eventDetails: NoteOnEventDetails) => {
      if (disabled) {
        return false;
      }
      onNoteOn?.(pitch, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      lastPitchRef.current = pitch;
      setSounding((current) => new Set(current).add(pitch));
      return true;
    },
    [disabled, onNoteOn]
  );

  const noteOff = React.useCallback(
    (pitch: number, eventDetails: NoteOffEventDetails) => {
      setSounding((current) => {
        const next = new Set(current);
        next.delete(pitch);
        return next;
      });
      onNoteOff?.(pitch, eventDetails);
    },
    [onNoteOff]
  );

  const nextIdRef = React.useRef(0);
  const createId = React.useCallback(() => {
    if (createNoteId) {
      return createNoteId();
    }
    const taken = new Set(valueRef.current.map((note) => note.id));
    let id = `note-${nextIdRef.current}`;
    while (taken.has(id)) {
      nextIdRef.current += 1;
      id = `note-${nextIdRef.current}`;
    }
    nextIdRef.current += 1;
    return id;
  }, [createNoteId]);

  const gridRef = React.useRef<HTMLElement | null>(null);
  const unitsPerPixel = React.useCallback(() => {
    if (zoom !== null) {
      return 1 / zoom;
    }
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    return duration / Math.max(width, 1);
  }, [duration, zoom]);

  // Focus that has to wait for the notes to render: a note just added, or
  // where focus goes once the focused note is removed.
  const noteElementsRef = React.useRef(new Map<NoteId, HTMLElement>());
  const pendingFocusRef = React.useRef<{ target: NoteId | null } | null>(null);
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
  const [, setFocusRequest] = React.useState(0);
  const focusAfterRender = React.useCallback((target: NoteId | null) => {
    pendingFocusRef.current = { target };
    setFocusRequest((count) => count + 1);
  }, []);
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

  const [band, setBand] = React.useState<Band | null>(null);
  const drawTemplateRef = React.useRef({ length: minLength, velocity: 1 });

  // The rows change when the pitches carrying notes do, not at every edit.
  const pitchKey = folded
    ? [...new Set(notes.map((note) => note.pitch))]
        .sort((a, b) => a - b)
        .join(",")
    : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pitchKey` stands for the pitches of `notes`.
  const rows = React.useMemo(
    () => rollRows(notes, minPitch, maxPitch, folded),
    [folded, maxPitch, minPitch, pitchKey]
  );
  const noteById = React.useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes]
  );

  const state = React.useMemo<Root.State>(
    () => ({ disabled, editing, folded: rows.folded, mode }),
    [disabled, editing, mode, rows.folded]
  );

  // Copied notes: kept on the roll, so a paste works from any note or the grid.
  const clipboardRef = React.useRef<readonly Note[]>([]);
  const { position } = timeline.meta;

  /** Applies an edit made from the keyboard and commits it at once; returns whether it was applied. */
  const applyKeyboardEdit = (
    next: Note[],
    edit: Edit,
    event: KeyboardEvent
  ): boolean => {
    const eventDetails = Object.assign(
      createChangeEventDetails("keyboard", event),
      { edit }
    ) as ValueChangeEventDetails;
    if (!change(next, eventDetails)) {
      return false;
    }
    commit([...valueRef.current], { edit, event, reason: "keyboard" });
    return true;
  };

  const selectIds = (ids: readonly NoteId[], event: KeyboardEvent) =>
    select(
      ids,
      createChangeEventDetails("keyboard", event) as SelectionChangeEventDetails
    );

  const duplicateSelection = (event: KeyboardEvent) => {
    const result = duplicateAfter(
      valueRef.current,
      selectionRef.current,
      createId,
      bounds
    );
    if (result && applyKeyboardEdit(result.notes, "duplicate", event)) {
      selectIds(result.copies, event);
    }
  };

  /** As in a DAW: with nothing selected, everything is quantized. */
  const quantizeSelection = (event: KeyboardEvent) => {
    const { current } = valueRef;
    const ids =
      selectionRef.current.size > 0
        ? selectionRef.current
        : new Set(current.map((note) => note.id));
    applyKeyboardEdit(
      quantizeNotes(current, ids, (start) => snapToGrid(start, grid), bounds),
      "quantize",
      event
    );
  };

  const copySelection = (event: KeyboardEvent, cut: boolean) => {
    const { current } = valueRef;
    const chosen = selectionRef.current;
    if (chosen.size === 0) {
      return;
    }
    clipboardRef.current = current.filter((note) => chosen.has(note.id));
    if (cut) {
      applyKeyboardEdit(
        current.filter((note) => !chosen.has(note.id)),
        "remove",
        event
      );
      selectIds([], event);
    }
  };

  const pasteClipboard = (event: KeyboardEvent) => {
    const result = pasteNotes(
      valueRef.current,
      clipboardRef.current,
      cellStart(position.get(), grid),
      createId,
      bounds
    );
    if (result && applyKeyboardEdit(result.notes, "paste", event)) {
      selectIds(result.pasted, event);
    }
  };

  const shortcut = (event: KeyboardEvent): boolean => {
    if (event.altKey) {
      return false;
    }
    const key = event.key.toLowerCase();
    const commands: Record<
      string,
      ((event: KeyboardEvent) => void) | undefined
    > =
      event.metaKey || event.ctrlKey
        ? {
            c: (copied) => copySelection(copied, false),
            d: duplicateSelection,
            v: pasteClipboard,
            x: (cut) => copySelection(cut, true),
          }
        : { q: quantizeSelection };
    const run = commands[key];
    run?.(event);
    return run !== undefined;
  };

  // What each part follows lives in a store, so editing one note renders it
  // and not the whole roll.
  const [view] = React.useState(() =>
    createStore<RollView>({ active, band, noteById, notes, selection })
  );
  React.useLayoutEffect(() => {
    view.set({ active, band, noteById, notes, selection });
  }, [active, band, noteById, notes, selection, view]);

  // The actions never change identity, so the parts reading them are not
  // rendered when a new callback is passed on every render.
  const latest = React.useRef({
    change,
    commit,
    createId,
    focusAfterRender,
    noteOff,
    noteOn,
    registerNote,
    select,
    setEditing,
    shortcut,
    unitsPerPixel,
  });
  latest.current = {
    change,
    commit,
    createId,
    focusAfterRender,
    noteOff,
    noteOn,
    registerNote,
    select,
    setEditing,
    shortcut,
    unitsPerPixel,
  };
  const actions = React.useMemo<PianoRollContextValue["actions"]>(
    () => ({
      change: (next, details) => latest.current.change(next, details),
      commit: (committed, details) => latest.current.commit(committed, details),
      createId: () => latest.current.createId(),
      focusAfterRender: (target) => latest.current.focusAfterRender(target),
      noteOff: (pitch, details) => latest.current.noteOff(pitch, details),
      noteOn: (pitch, details) => latest.current.noteOn(pitch, details),
      registerNote: (id, node) => latest.current.registerNote(id, node),
      select: (ids, details) => latest.current.select(ids, details),
      setBand,
      setEditing: (next) => latest.current.setEditing(next),
      shortcut: (event) => latest.current.shortcut(event),
      unitsPerPixel: () => latest.current.unitsPerPixel(),
    }),
    []
  );

  const context = React.useMemo<PianoRollContextValue>(
    () => ({
      actions,
      meta: {
        bounds,
        drawTemplateRef,
        getNoteLabel,
        gridRef,
        lastPitchRef,
        rows,
        selectionRef,
        valueRef,
        view,
      },
      state,
    }),
    [actions, bounds, getNoteLabel, rows, state, view]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { [ROWS_PROPERTY as string]: rows.pitches.length } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });

  return <PianoRollContext value={context}>{element}</PianoRollContext>;
}

export namespace Root {
  export type State = PianoRollState;
  export type Note = import("../internal/edits").Note;
  export type NoteId = import("../internal/edits").NoteId;
  export type Edit = import("../context").Edit;
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = ValueChangeEventDetails;
  export type CommitEventDetails = ValueCommitEventDetails;
  export type SelectionChangeEventDetails =
    import("../context").SelectionChangeEventDetails;
  export type NoteOnEventDetails = import("../context").NoteOnEventDetails;
  export type NoteOffEventDetails = import("../context").NoteOffEventDetails;

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
