import * as React from "react";
import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "../internal/event-details";
import type { Note, NoteId, RollBounds } from "./internal/edits";
import type { Rows } from "./internal/rows";

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
export type Edit = "add" | "duplicate" | "move" | "remove" | "resize";

type WithEdit<Details> = Details & {
  /** What the change did: one gesture keeps one `edit` throughout. */
  edit: Edit;
};

export type ValueChangeEventDetails =
  | WithEdit<ExtraChangeEventDetails<"draw", PointerEvent>>
  | WithEdit<ExtraChangeEventDetails<"drag", PointerEvent>>
  | WithEdit<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
  | WithEdit<ExtraChangeEventDetails<"double-click", MouseEvent>>;

export type ValueCommitEventDetails =
  | WithEdit<ExtraCommitEventDetails<"draw", PointerEvent>>
  | WithEdit<ExtraCommitEventDetails<"drag", PointerEvent>>
  | WithEdit<ExtraCommitEventDetails<"keyboard", KeyboardEvent>>
  | WithEdit<ExtraCommitEventDetails<"double-click", MouseEvent>>;

export type SelectionChangeEventDetails =
  | ExtraChangeEventDetails<"press", PointerEvent>
  | ExtraChangeEventDetails<"marquee", PointerEvent>
  | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
  | ExtraChangeEventDetails<"draw", PointerEvent>
  | ExtraChangeEventDetails<"drag", PointerEvent>
  | ExtraChangeEventDetails<"double-click", MouseEvent>;

type WithVelocity<Details> = Details & {
  /** How hard the note is played, 0…1. */
  velocity: number;
};

/** Why a pitch sounds: a key pressed, glided onto or played from the keyboard, or a note drawn, picked up or moved. */
export type NoteOnEventDetails =
  | WithVelocity<ExtraChangeEventDetails<"press", PointerEvent>>
  | WithVelocity<ExtraChangeEventDetails<"glide", PointerEvent>>
  | WithVelocity<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
  | WithVelocity<ExtraChangeEventDetails<"draw", PointerEvent>>
  | WithVelocity<ExtraChangeEventDetails<"drag", PointerEvent>>;

export type NoteOffEventDetails =
  | ExtraCommitEventDetails<"press", PointerEvent>
  | ExtraCommitEventDetails<"glide", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", FocusEvent | KeyboardEvent>
  | ExtraCommitEventDetails<"draw", PointerEvent>
  | ExtraCommitEventDetails<"drag", PointerEvent>;

/** A selection rectangle, in px from the grid's top left corner. */
export interface Band {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface PianoRollContextValue {
  actions: {
    /** Proposes new notes; returns whether they were applied. */
    change: (next: Note[], eventDetails: ValueChangeEventDetails) => boolean;
    commit: (value: Note[], eventDetails: ValueCommitEventDetails) => void;
    /** A new note id, unused by any note. */
    createId: () => NoteId;
    /** Focuses this note, or the grid with `null`, once the next render is done. */
    focusAfterRender: (target: NoteId | null) => void;
    noteOff: (pitch: number, eventDetails: NoteOffEventDetails) => void;
    /** Sounds a pitch; returns whether it sounded. */
    noteOn: (pitch: number, eventDetails: NoteOnEventDetails) => boolean;
    registerNote: (id: NoteId, node: HTMLElement | null) => void;
    /** Proposes a selection; returns whether it was applied. */
    select: (
      ids: readonly NoteId[],
      eventDetails: SelectionChangeEventDetails
    ) => boolean;
    setBand: (band: Band | null) => void;
    setEditing: (editing: boolean) => void;
    /** The timeline's units covered by one px of the grid. */
    unitsPerPixel: () => number;
  };
  meta: {
    /** Pitches sounding: auditioned here, or listed in `activePitches`. */
    active: ReadonlySet<number>;
    band: Band | null;
    bounds: RollBounds;
    /** The length and velocity a drawn note gets: those last drawn or resized. */
    drawTemplateRef: React.RefObject<{ length: number; velocity: number }>;
    getNoteLabel: (note: Note) => string;
    gridRef: React.RefObject<HTMLElement | null>;
    /** The pitch last auditioned: where a note added from the keyboard goes. */
    lastPitchRef: React.RefObject<number | null>;
    noteById: ReadonlyMap<NoteId, Note>;
    /** The notes as displayed. */
    notes: readonly Note[];
    rows: Rows;
    selection: ReadonlySet<NoteId>;
    /** Latest selection, readable from event handlers. */
    selectionRef: React.RefObject<ReadonlySet<NoteId>>;
    /** Latest displayed notes, readable from event handlers. */
    valueRef: React.RefObject<readonly Note[]>;
  };
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
