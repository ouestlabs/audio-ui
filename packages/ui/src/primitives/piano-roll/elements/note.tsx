import { createChangeEventDetails, isReleased } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { placedOver, useTimelineContext } from "../../timeline/context";
import {
  bypassesGrid,
  type Grid,
  snapMove,
} from "../../timeline/internal/snap";
import {
  type Edit,
  type PianoRollContextValue,
  placedOnRow,
  usePianoRollContext,
  useRollView,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
  VELOCITY_PROPERTY,
} from "../context";
import {
  duplicateNotes,
  keyboardEdit,
  moveNotes,
  type NoteId,
  type Note as NoteValue,
  type RollBounds,
  resizeNotes,
  snapEdgeDelta,
  spatialOrder,
} from "../internal/edits";
import type { Rows } from "../internal/rows";
import { DRAG_THRESHOLD } from "./grid";

const NO_GRID = { offset: 0, step: 0 };

interface NoteContextValue {
  elementRef: React.RefObject<HTMLElement | null>;
  note: NoteValue;
}

const NoteContext = React.createContext<NoteContextValue | null>(null);

type GestureKind = "end" | "move" | "start";

interface NoteGesture {
  /** The note under the pointer, as it was: the one that lands on the grid. */
  anchor: NoteValue;
  changed: boolean;
  /** Alt was held: the drag carries copies off and leaves the notes. */
  copy: boolean;
  edit: Edit;
  /** The notes the gesture moves: the selection, or just this note. */
  ids: ReadonlySet<NoteId>;
  /** The notes when the gesture began: every move is measured from them. */
  origin: NoteValue[];
  pointerId: number;
  rowHeight: number;
  /** The rows when the gesture began, which a folded roll changes under it. */
  rows: Rows;
  sounding: number | null;
  started: boolean;
  startX: number;
  startY: number;
}

function changeDetails(
  reason: "drag" | "keyboard",
  event: Event,
  edit: Edit
): ValueChangeEventDetails {
  return Object.assign(createChangeEventDetails(reason, event), {
    edit,
  }) as ValueChangeEventDetails;
}

/**
 * Where a gesture puts the notes once the pointer has moved by `units`
 * across and `dy` px down: moved, landing the note under the pointer on the
 * grid and on a row, or resized from one edge.
 */
function draggedNotes(
  gesture: NoteGesture,
  kind: GestureKind,
  units: number,
  dy: number,
  grid: Grid,
  bounds: RollBounds
): NoteValue[] {
  const { anchor } = gesture;
  if (kind !== "move") {
    return resizeNotes(
      gesture.origin,
      gesture.ids,
      kind,
      snapEdgeDelta(anchor, kind, units, grid),
      bounds
    );
  }
  const start = snapMove(anchor.start + units, anchor.start, grid);
  const rows = gesture.rowHeight > 0 ? Math.round(dy / gesture.rowHeight) : 0;
  return moveNotes(
    gesture.origin,
    gesture.ids,
    start - anchor.start,
    gesture.rows.step(anchor.pitch, rows) - anchor.pitch,
    bounds
  );
}

/**
 * Pointer handlers that move a note, or resize one of its edges, together
 * with the rest of the selection when it is part of it. Every move is
 * measured from where the gesture began, so the dragged note lands on the
 * grid and the others keep their spacing.
 */
function useNoteGesture(
  roll: PianoRollContextValue,
  note: NoteValue,
  kind: GestureKind,
  elementRef: React.RefObject<HTMLElement | null>
) {
  const { actions, meta, state } = roll;
  const { meta: timeline } = useTimelineContext("Lane");
  const gestureRef = React.useRef<NoteGesture | null>(null);

  /** Sounds `pitch` in place of what the gesture was sounding. */
  const audition = (
    gesture: NoteGesture,
    pitch: number,
    event: PointerEvent
  ) => {
    if (gesture.sounding === pitch) {
      return;
    }
    if (gesture.sounding !== null) {
      actions.noteOff(gesture.sounding, { event, reason: "drag" });
    }
    const sounded = actions.noteOn(
      pitch,
      Object.assign(createChangeEventDetails("drag", event), {
        velocity: note.velocity ?? 1,
      })
    );
    gesture.sounding = sounded ? pitch : null;
  };

  /** Swaps the notes being dragged for copies left on top of them. */
  const copyNotes = (gesture: NoteGesture, event: PointerEvent) => {
    const { copyOf, notes } = duplicateNotes(
      gesture.origin,
      gesture.ids,
      actions.createId
    );
    if (!actions.change(notes, changeDetails("drag", event, "duplicate"))) {
      return;
    }
    gesture.origin = notes;
    gesture.ids = new Set(copyOf.values());
    gesture.anchor = { ...gesture.anchor, id: copyOf.get(note.id) ?? note.id };
    gesture.edit = "duplicate";
    actions.select([...gesture.ids], createChangeEventDetails("drag", event));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (state.disabled) {
      return;
    }
    event.preventDefault();
    elementRef.current?.focus({ focusVisible: false, preventScroll: true });
    const selection = meta.selectionRef.current;
    if (kind === "move" && event.shiftKey) {
      const next = selection.has(note.id)
        ? [...selection].filter((id) => id !== note.id)
        : [...selection, note.id];
      actions.select(
        next,
        createChangeEventDetails("press", event.nativeEvent)
      );
      return;
    }
    let ids = selection;
    if (!selection.has(note.id)) {
      ids = new Set([note.id]);
      actions.select(
        [note.id],
        createChangeEventDetails("press", event.nativeEvent)
      );
    }
    const grid = meta.gridRef.current?.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    actions.setEditing(true);
    const gesture: NoteGesture = {
      anchor: note,
      changed: false,
      copy: kind === "move" && event.altKey,
      edit: kind === "move" ? "move" : "resize",
      ids,
      origin: [...meta.valueRef.current],
      pointerId: event.pointerId,
      rowHeight: (grid?.height ?? 0) / meta.rows.pitches.length,
      rows: meta.rows,
      sounding: null,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    gestureRef.current = gesture;
    audition(gesture, note.pitch, event.nativeEvent);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      onPointerEnd(event);
      return;
    }
    event.stopPropagation();
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.started) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD ** 2) {
        return;
      }
      gesture.started = true;
      if (gesture.copy) {
        copyNotes(gesture, event.nativeEvent);
      }
    }
    const next = draggedNotes(
      gesture,
      kind,
      dx * actions.unitsPerPixel(),
      dy,
      bypassesGrid(event) ? NO_GRID : timeline.grid,
      meta.bounds
    );
    if (
      actions.change(
        next,
        changeDetails("drag", event.nativeEvent, gesture.edit)
      )
    ) {
      gesture.changed = true;
    }
    const moved = meta.valueRef.current.find(
      (other) => other.id === gesture.anchor.id
    );
    if (moved) {
      audition(gesture, moved.pitch, event.nativeEvent);
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the notes fall back to the known value after.
    const committed = [...meta.valueRef.current];
    actions.setEditing(false);
    if (gesture.changed) {
      const resized = committed.find((other) => other.id === gesture.anchor.id);
      if (kind !== "move" && resized) {
        meta.drawTemplateRef.current.length = resized.length;
      }
      actions.commit(committed, {
        edit: gesture.edit,
        event: event.nativeEvent,
        reason: "drag",
      });
      if (gesture.edit === "duplicate") {
        // The copy is what was dragged: the keys should act on it next.
        actions.focusAfterRender(gesture.anchor.id);
      }
    }
    if (gesture.sounding !== null) {
      actions.noteOff(gesture.sounding, {
        event: event.nativeEvent,
        reason: "drag",
      });
    }
  };

  return {
    onLostPointerCapture: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
  };
}

/**
 * One note, placed at its start and pitch: on the timeline's units across and
 * on its row down. Dragging it moves it, and the rest of the selection with
 * it, on the grid unless Cmd/Ctrl is held; with Alt the drag carries copies
 * off. Shift + click adds it to the selection or takes it out, a double-click
 * removes it.
 *
 * Focused, the arrow keys move it (Up and Down by a semitone, an octave with
 * Shift), Shift + Left and Right change its length, Enter or Space selects it
 * and Delete removes it, all of them acting on the selection when the note is
 * part of it. Its `--piano-roll-velocity` CSS variable is its velocity.
 * Renders a `<div>` element.
 */
export function Note(componentProps: Note.Props) {
  const {
    children,
    className,
    note: noteProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const roll = usePianoRollContext("Note");
  const { actions, meta, state: rollState } = roll;
  const { meta: timeline } = useTimelineContext("Lane");
  // The displayed note: it moves while a gesture edits it.
  const shown = useRollView("Note", (view) => view.noteById.get(noteProp.id));
  const note = shown ?? noteProp;
  const elementRef = React.useRef<HTMLElement | null>(null);
  const soundingRef = React.useRef<number | null>(null);
  const { disabled } = rollState;
  const selected = useRollView("Note", (view) => view.selection.has(note.id));
  const gesture = useNoteGesture(roll, note, "move", elementRef);

  const noteRef = React.useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node;
      actions.registerNote(note.id, node);
    },
    [actions, note.id]
  );

  const silence = (event: FocusEvent | KeyboardEvent) => {
    if (soundingRef.current !== null) {
      actions.noteOff(soundingRef.current, { event, reason: "keyboard" });
      soundingRef.current = null;
    }
  };

  /** The notes a key press acts on: the selection, when this note is part of it. */
  const targets = () => {
    const selection = meta.selectionRef.current;
    return selection.has(note.id) ? selection : new Set([note.id]);
  };

  const remove = (
    ids: ReadonlySet<NoteId>,
    reason: "double-click" | "keyboard",
    event: KeyboardEvent | MouseEvent
  ) => {
    const base = meta.valueRef.current;
    const order = spatialOrder(base);
    const index = order.findIndex((other) => other.id === note.id);
    const kept = (other: NoteValue) => !ids.has(other.id);
    const neighbour =
      order.slice(index + 1).find(kept) ?? order.slice(0, index).findLast(kept);
    const next = base.filter(kept);
    const eventDetails = Object.assign(
      createChangeEventDetails(reason, event),
      {
        edit: "remove" as const,
      }
    ) as ValueChangeEventDetails;
    if (!actions.change(next, eventDetails)) {
      return;
    }
    actions.commit(next, {
      edit: "remove",
      event,
      reason,
    } as ValueCommitEventDetails);
    actions.select(
      [...meta.selectionRef.current].filter((id) => !ids.has(id)),
      createChangeEventDetails(
        reason,
        event
      ) as Note.SelectionChangeEventDetails
    );
    if (reason === "keyboard") {
      actions.focusAfterRender(neighbour?.id ?? null);
    }
  };

  /** Applies an edit from the keyboard and commits it at once. */
  const apply = (next: NoteValue[], edit: Edit, event: KeyboardEvent) => {
    if (actions.change(next, changeDetails("keyboard", event, edit))) {
      actions.commit([...meta.valueRef.current], {
        edit,
        event,
        reason: "keyboard",
      });
      // Notes render in the order they are read, so a move can reorder them
      // and take the focus with it.
      actions.focusAfterRender(note.id);
    }
  };

  /** Sounds the note's new pitch after a key moved it, until the key is released. */
  const auditionMove = (before: number, event: KeyboardEvent) => {
    const after = meta.valueRef.current.find((other) => other.id === note.id);
    if (!after || after.pitch === before) {
      return;
    }
    silence(event);
    const sounded = actions.noteOn(
      after.pitch,
      Object.assign(createChangeEventDetails("keyboard", event), {
        velocity: after.velocity ?? 1,
      })
    );
    soundingRef.current = sounded ? after.pitch : null;
  };

  const toggleSelected = (event: KeyboardEvent) => {
    const selection = meta.selectionRef.current;
    actions.select(
      selection.has(note.id)
        ? [...selection].filter((id) => id !== note.id)
        : [...selection, note.id],
      createChangeEventDetails("keyboard", event)
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const native = event.nativeEvent;
    if (actions.shortcut(native)) {
      event.preventDefault();
      // Handled: the grid around the note would run it again.
      event.stopPropagation();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(targets(), "keyboard", native);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSelected(native);
      return;
    }
    const result = keyboardEdit(
      [...meta.valueRef.current],
      targets(),
      event.key,
      event.shiftKey,
      timeline.step,
      meta.bounds
    );
    if (!result) {
      return;
    }
    event.preventDefault();
    const before = note.pitch;
    apply(result.notes, result.edit, native);
    auditionMove(before, native);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      silence(event.nativeEvent);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!disabled) {
      remove(new Set([note.id]), "double-click", event.nativeEvent);
    }
  };

  const state = React.useMemo<Note.State>(
    () => ({ disabled, selected }),
    [disabled, selected]
  );
  const context = React.useMemo<NoteContextValue>(
    () => ({ elementRef, note }),
    [note]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...gesture,
        "aria-disabled": disabled || undefined,
        "aria-label": meta.getNoteLabel(note),
        "aria-pressed": selected,
        children,
        onBlur: (event) => silence(event.nativeEvent),
        onDoubleClick: handleDoubleClick,
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp,
        role: "button",
        style: {
          ...placedOver(note.start, note.length),
          ...placedOnRow(meta.rows.rowOf(note.pitch)),
          [VELOCITY_PROPERTY as string]: note.velocity ?? 1,
          touchAction: "none",
        },
        tabIndex: disabled ? -1 : 0,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, noteRef] : noteRef,
    render,
    state,
  });

  return <NoteContext value={context}>{element}</NoteContext>;
}

export namespace Note {
  export type State = {
    disabled: boolean;
    /** Whether the note is in the selection. */
    selected: boolean;
  };
  export type SelectionChangeEventDetails =
    import("../context").SelectionChangeEventDetails;
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode;
    /** The note to show; while it is being edited, the roll shows it where the edit has it. */
    note: NoteValue;
  }
}

/**
 * One edge of the note it sits in, dragged to change the note's length: the
 * end makes it longer or shorter, the start trims it from the front while its
 * end stays put. On the grid unless Cmd/Ctrl is held, and for the whole
 * selection when the note is part of it. Shift + Left and Right on the note
 * do the same from the keyboard, so the handle is hidden from assistive
 * technology. Renders a `<div>` element.
 */
export function NoteHandle(componentProps: NoteHandle.Props) {
  const { className, edge, ref, render, style, ...elementProps } =
    componentProps;
  const roll = usePianoRollContext("NoteHandle");
  const context = React.use(NoteContext);
  if (!context) {
    throw new Error("PianoRoll.NoteHandle must be used within PianoRoll.Note");
  }
  const gesture = useNoteGesture(roll, context.note, edge, context.elementRef);
  const selected = useRollView("NoteHandle", (view) =>
    view.selection.has(context.note.id)
  );
  const state = React.useMemo<NoteHandle.State>(
    () => ({ disabled: roll.state.disabled, edge, selected }),
    [edge, roll.state.disabled, selected]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { ...gesture, "aria-hidden": true, style: { touchAction: "none" } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace NoteHandle {
  export type State = Note.State & {
    /** The edge this handle drags. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the note this handle drags. */
    edge: "end" | "start";
  }
}
