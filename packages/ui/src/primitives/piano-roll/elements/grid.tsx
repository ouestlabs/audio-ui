import { createChangeEventDetails, isReleased } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { valueAtPointer } from "../../timeline/context";
import { LaneContext, useLaneProps } from "../../timeline/elements/lane";
import { bypassesGrid, snapToGrid } from "../../timeline/internal/snap";
import { type PianoRollState, usePianoRollContext } from "../context";
import {
  cellStart,
  type NoteId,
  notesWithin,
  sanitizeNote,
} from "../internal/edits";

/** How far a pointer moves before a press on the grid becomes a drag. */
export const DRAG_THRESHOLD = 4;

type GridGesture =
  | {
      kind: "draw";
      id: NoteId;
      pointerId: number;
      sounding: number | null;
      start: number;
      started: boolean;
      startX: number;
      startY: number;
    }
  | {
      /** What was selected before, kept when Shift started the rectangle. */
      base: readonly NoteId[];
      kind: "marquee";
      pointerId: number;
      x: number;
      y: number;
    };

/**
 * The surface notes are drawn on: a timeline lane, with the roll's rows
 * stacked down it. A press on empty grid draws a note (`mode="draw"`), whose
 * end then follows the pointer, or starts a selection rectangle, Shift adding
 * to what is selected; in that mode a double-click draws. Focused, Enter adds
 * a note at the playback position, Escape clears the selection and Cmd/Ctrl+A
 * selects every note. From the grid or a note, Cmd/Ctrl+D repeats the
 * selection right after itself, Cmd/Ctrl+C, X and V copy, cut and paste at the
 * playback position, and Q snaps the starts of the selection (every note, with
 * none selected) to the grid. Renders a `<div>` element.
 */
export function Grid(componentProps: Grid.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const roll = usePianoRollContext("Grid");
  const { actions, meta, state } = roll;
  const {
    context: timeline,
    lane,
    laneRef,
    style: laneStyle,
  } = useLaneProps("Lane");
  const { duration, grid, position, zoom } = timeline.meta;
  const gestureRef = React.useRef<GridGesture | null>(null);

  /** The row under `clientY`, within the grid. */
  const rowAt = (element: HTMLElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const count = meta.rows.pitches.length;
    const row = Math.floor(((clientY - rect.top) / rect.height) * count);
    return Math.min(count - 1, Math.max(0, row));
  };

  /** Adds a note at `start` on `pitch`, of the length last drawn; returns it if it was applied. */
  const addNote = (
    start: number,
    pitch: number,
    reason: "double-click" | "draw" | "keyboard",
    event: Event
  ) => {
    const { length, velocity } = meta.drawTemplateRef.current;
    const note = sanitizeNote(
      { id: actions.createId(), length, pitch, start, velocity },
      meta.bounds
    );
    const eventDetails = Object.assign(
      createChangeEventDetails(reason, event),
      {
        edit: "add" as const,
      }
    );
    if (
      !actions.change(
        [...meta.valueRef.current, note],
        eventDetails as Grid.ChangeEventDetails
      )
    ) {
      return null;
    }
    actions.select(
      [note.id],
      createChangeEventDetails(
        reason,
        event
      ) as Grid.SelectionChangeEventDetails
    );
    return note;
  };

  /** Where a note drawn under the pointer starts: the grid cell it is in. */
  const startAt = (
    element: HTMLElement,
    event: React.PointerEvent | React.MouseEvent
  ) => {
    const raw = valueAtPointer(element, event.clientX, zoom, duration);
    return bypassesGrid(event) ? raw : cellStart(raw, grid);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || state.disabled) {
      return;
    }
    const element = event.currentTarget;
    event.preventDefault();
    element.focus({ focusVisible: false, preventScroll: true });
    if (state.mode === "select") {
      const rect = element.getBoundingClientRect();
      const selection = meta.selectionRef.current;
      if (!event.shiftKey) {
        actions.select(
          [],
          createChangeEventDetails("marquee", event.nativeEvent)
        );
      }
      element.setPointerCapture?.(event.pointerId);
      gestureRef.current = {
        base: event.shiftKey ? [...selection] : [],
        kind: "marquee",
        pointerId: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      return;
    }
    const pitch = meta.rows.pitchAt(rowAt(element, event.clientY));
    actions.setEditing(true);
    const note = addNote(
      startAt(element, event),
      pitch,
      "draw",
      event.nativeEvent
    );
    if (!note) {
      actions.setEditing(false);
      return;
    }
    element.setPointerCapture?.(event.pointerId);
    const sounding = actions.noteOn(
      note.pitch,
      Object.assign(createChangeEventDetails("draw", event.nativeEvent), {
        velocity: note.velocity ?? 1,
      })
    );
    gestureRef.current = {
      id: note.id,
      kind: "draw",
      pointerId: event.pointerId,
      sounding: sounding ? note.pitch : null,
      start: note.start,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    const element = event.currentTarget;
    if (gesture.kind === "marquee") {
      const rect = element.getBoundingClientRect();
      const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
      const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
      const band = {
        height: Math.abs(y - gesture.y),
        left: Math.min(x, gesture.x),
        top: Math.min(y, gesture.y),
        width: Math.abs(x - gesture.x),
      };
      actions.setBand(band);
      const unitsPerPixel = actions.unitsPerPixel();
      const rowHeight = rect.height / meta.rows.pitches.length;
      const within = notesWithin(
        meta.valueRef.current,
        {
          end: (band.left + band.width) * unitsPerPixel,
          firstRow: Math.floor(band.top / rowHeight),
          lastRow: Math.ceil((band.top + band.height) / rowHeight) - 1,
          start: band.left * unitsPerPixel,
        },
        meta.rows.rowOf
      );
      actions.select(
        [...new Set([...gesture.base, ...within])],
        createChangeEventDetails("marquee", event.nativeEvent)
      );
      return;
    }
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.started && dx * dx + dy * dy < DRAG_THRESHOLD ** 2) {
      return;
    }
    gesture.started = true;
    const raw = valueAtPointer(element, event.clientX, zoom, duration);
    const end = bypassesGrid(event) ? raw : snapToGrid(raw, grid);
    const length = Math.min(
      duration - gesture.start,
      Math.max(meta.bounds.minLength, end - gesture.start)
    );
    const next = meta.valueRef.current.map((note) =>
      note.id === gesture.id ? { ...note, length } : note
    );
    actions.change(
      next,
      Object.assign(createChangeEventDetails("draw", event.nativeEvent), {
        edit: "add" as const,
      })
    );
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    if (gesture.kind === "marquee") {
      actions.setBand(null);
      return;
    }
    // Read before settling: the notes fall back to the known value after.
    const committed = [...meta.valueRef.current];
    actions.setEditing(false);
    const drawn = committed.find((note) => note.id === gesture.id);
    if (drawn) {
      meta.drawTemplateRef.current.length = drawn.length;
    }
    actions.commit(committed, {
      edit: "add",
      event: event.nativeEvent,
      reason: "draw",
    });
    if (gesture.sounding !== null) {
      actions.noteOff(gesture.sounding, {
        event: event.nativeEvent,
        reason: "draw",
      });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (state.disabled || state.mode !== "select") {
      return;
    }
    const element = event.currentTarget;
    const pitch = meta.rows.pitchAt(rowAt(element, event.clientY));
    const note = addNote(
      startAt(element, event),
      pitch,
      "double-click",
      event.nativeEvent
    );
    if (note) {
      actions.commit([...meta.valueRef.current], {
        edit: "add",
        event: event.nativeEvent,
        reason: "double-click",
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (state.disabled) {
      return;
    }
    const native = event.nativeEvent;
    if (actions.shortcut(native)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      actions.select([], createChangeEventDetails("keyboard", native));
      return;
    }
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      actions.select(
        meta.valueRef.current.map((other) => other.id),
        createChangeEventDetails("keyboard", native)
      );
      return;
    }
    if (event.key !== "Enter" || event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    const { pitches } = meta.rows;
    const lastPitch = meta.lastPitchRef.current;
    const pitch =
      lastPitch ??
      pitches[Math.floor(pitches.length / 2)] ??
      meta.bounds.minPitch;
    const note = addNote(
      cellStart(position.get(), grid),
      pitch,
      "keyboard",
      native
    );
    if (note) {
      actions.commit([...meta.valueRef.current], {
        edit: "add",
        event: native,
        reason: "keyboard",
      });
      actions.focusAfterRender(note.id);
    }
  };

  const gridRef = React.useCallback(
    (node: HTMLElement | null) => {
      meta.gridRef.current = node;
      laneRef(node);
    },
    [laneRef, meta.gridRef]
  );

  const rendered = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        onKeyDown: handleKeyDown,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        role: "group",
        style: { ...laneStyle, touchAction: "none" },
        tabIndex: state.disabled ? -1 : 0,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, gridRef] : gridRef,
    render,
    state,
  });

  return <LaneContext value={lane}>{rendered}</LaneContext>;
}

export namespace Grid {
  export type State = PianoRollState;
  export type Props = PartProps<"div", State>;
  export type ChangeEventDetails = import("../context").ValueChangeEventDetails;
  export type SelectionChangeEventDetails =
    import("../context").SelectionChangeEventDetails;
}
