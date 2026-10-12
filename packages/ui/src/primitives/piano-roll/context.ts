import type {
  Note,
  NoteId,
  PianoRollBand,
  PianoRollChangeEventDetails,
  PianoRollCommitEventDetails,
  PianoRollController,
  PianoRollEdit,
  PianoRollNoteOffEventDetails,
  PianoRollNoteOnEventDetails,
  PianoRollSelectionEventDetails,
  PianoRollSnapshot,
  Rows,
} from "@audio-ui/core/piano-roll";
import * as React from "react";

/** Set on the root: how many rows the roll draws. */
export const ROWS_PROPERTY = "--piano-roll-rows";
/** Set on every part placed on a row: which one, from the top. */
export const ROW_PROPERTY = "--piano-roll-row";
/** Set on every note: its velocity, 0…1. */
export const VELOCITY_PROPERTY = "--piano-roll-velocity";

/** Places a part on `row`, counted from the top, sharing the height with every other row. */
export function placedOnRow(row: number): React.CSSProperties {
  return {
    [ROW_PROPERTY as string]: row,
    height: `calc(100% / var(${ROWS_PROPERTY}))`,
    position: "absolute",
    top: `calc(100% * var(${ROW_PROPERTY}) / var(${ROWS_PROPERTY}))`,
  };
}

export type PianoRollState = {
  disabled: boolean;
  /** Whether a pointer is drawing, moving or resizing notes. */
  editing: boolean;
  /** Whether only the pitches carrying notes have a row. */
  folded: boolean;
  /** What a press on empty grid does: draw a note, or start a selection rectangle. */
  mode: "draw" | "select";
};

/** What a change did to the notes. */
export type Edit = PianoRollEdit;

/** A selection rectangle, in px from the grid's top left corner. */
export type Band = PianoRollBand;

export type ValueChangeEventDetails = PianoRollChangeEventDetails;
export type ValueCommitEventDetails = PianoRollCommitEventDetails;
export type SelectionChangeEventDetails = PianoRollSelectionEventDetails;
export type NoteOnEventDetails = PianoRollNoteOnEventDetails;
export type NoteOffEventDetails = PianoRollNoteOffEventDetails;

/** What a view draws the roll from; a part reads only the piece it shows. */
export type RollView = PianoRollSnapshot;

export interface PianoRollContextValue {
  /** The framework-free roll behind every part: notes, selection, gestures, keys. */
  controller: PianoRollController;
  /** Focuses this note, or the grid with `null`, once the next render is done. */
  focusAfterRender: (target: NoteId | null) => void;
  getNoteLabel: (note: Note) => string;
  gridRef: React.RefObject<HTMLElement | null>;
  /** Records a note's element, and takes the focus when it was asked for. */
  registerNote: (id: NoteId, node: HTMLElement | null) => void;
  /** The roll's rows: what the pitches it draws, and where a note sits. */
  rows: Rows;
  state: PianoRollState;
}

export const PianoRollContext =
  React.createContext<PianoRollContextValue | null>(null);

export function usePianoRollContext(part: string): PianoRollContextValue {
  const context = React.use(PianoRollContext);
  if (!context) {
    throw new Error(`PianoRoll.${part} must be used within PianoRoll.Root`);
  }
  return context;
}

/**
 * A piece of the roll's changing state, re-rendering only when that piece
 * changes: `select` runs on every change, and `equal` says whether the piece
 * it returned is the same as before.
 */
export function useRollView<T>(
  part: string,
  select: (view: RollView) => T,
  equal: (a: T, b: T) => boolean = Object.is
): T {
  const { controller } = usePianoRollContext(part);
  const last = React.useRef<{ value: T } | null>(null);
  const getSnapshot = React.useCallback(() => {
    const next = select(controller.getSnapshot());
    if (last.current && equal(last.current.value, next)) {
      return last.current.value;
    }
    last.current = { value: next };
    return next;
  }, [controller, equal, select]);
  return React.useSyncExternalStore(
    controller.subscribe,
    getSnapshot,
    getSnapshot
  );
}

/** Whether two objects have the same fields, each compared with `Object.is`. */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.is(a[key], b[key]))
  );
}
