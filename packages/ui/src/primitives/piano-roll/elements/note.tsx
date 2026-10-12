import type { Note as NoteValue } from "@audio-ui/core/piano-roll";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { placedOver } from "../../timeline/context.js";
import {
  placedOnRow,
  usePianoRollContext,
  useRollView,
  VELOCITY_PROPERTY,
} from "../context.js";

interface NoteContextValue {
  elementRef: React.RefObject<HTMLElement | null>;
  note: NoteValue;
}

const NoteContext = React.createContext<NoteContextValue | null>(null);

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
  const { controller, getNoteLabel, gridRef, registerNote, rows, state } = roll;
  // The displayed note: it moves while a gesture edits it.
  const shown = useRollView("Note", (view) => view.noteById.get(noteProp.id));
  const note = shown ?? noteProp;
  const elementRef = React.useRef<HTMLElement | null>(null);
  const { disabled } = state;
  const selected = useRollView("Note", (view) => view.selection.has(note.id));

  const noteRef = React.useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node;
      registerNote(note.id, node);
    },
    [note.id, registerNote]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const grid = gridRef.current;
    if (disabled || !grid) {
      return;
    }
    event.preventDefault();
    elementRef.current?.focus({ focusVisible: false, preventScroll: true });
    controller.pressNote(
      note.id,
      "move",
      event.nativeEvent,
      event.currentTarget,
      grid
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const native = event.nativeEvent;
    if (controller.shortcut(native)) {
      event.preventDefault();
      // Handled: the grid around the note would run it again.
      event.stopPropagation();
      return;
    }
    if (controller.keyNote(note.id, native)) {
      event.preventDefault();
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      controller.releaseKey(event.nativeEvent);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!disabled) {
      controller.doubleClickNote(note.id, event.nativeEvent);
    }
  };

  const noteState = React.useMemo<Note.State>(
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
        "aria-disabled": disabled || undefined,
        "aria-label": getNoteLabel(note),
        "aria-pressed": selected,
        children,
        onBlur: (event) => controller.releaseKey(event.nativeEvent),
        onDoubleClick: handleDoubleClick,
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp,
        onPointerDown: handlePointerDown,
        role: "button",
        style: {
          ...placedOver(note.start, note.length),
          ...placedOnRow(rows.rowOf(note.pitch)),
          [VELOCITY_PROPERTY as string]: note.velocity ?? 1,
          touchAction: "none",
        },
        tabIndex: disabled ? -1 : 0,
      },
      { ...elementProps, ...resolveStyling(className, style, noteState) }
    ),
    ref: ref ? [ref, noteRef] : noteRef,
    render,
    state: noteState,
  });

  return <NoteContext value={context}>{element}</NoteContext>;
}

export namespace Note {
  export type State = {
    disabled: boolean;
    /** Whether the note is in the selection. */
    selected: boolean;
  };
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode;
    /** The note to draw: the roll's copy of it is used once it is edited. */
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
  const { controller, gridRef, state: rollState } = roll;
  const { note } = context;
  const selected = useRollView("NoteHandle", (view) =>
    view.selection.has(note.id)
  );
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const grid = gridRef.current;
    if (rollState.disabled || !grid) {
      return;
    }
    event.preventDefault();
    context.elementRef.current?.focus({
      focusVisible: false,
      preventScroll: true,
    });
    controller.pressNote(
      note.id,
      edge,
      event.nativeEvent,
      event.currentTarget,
      grid
    );
  };
  const state = React.useMemo<NoteHandle.State>(
    () => ({ disabled: rollState.disabled, edge, selected }),
    [edge, rollState.disabled, selected]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        onPointerDown: handlePointerDown,
        style: { touchAction: "none" },
      },
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
