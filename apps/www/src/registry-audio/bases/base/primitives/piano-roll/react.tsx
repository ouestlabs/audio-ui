import type { Note as NoteValue } from "@audio-ui/primitives/piano-roll";
import { pianoRoll } from "@audio-ui/primitives/piano-roll";
import { createParts } from "@ui-sdk/react/primitive";
import { type ComponentProps, Fragment, type ReactNode } from "react";

/** Which element each part is. */
const parts = createParts(pianoRoll, {
  grid: "div",
  keys: "div",
  marquee: "div",
  note: "div",
  noteEnd: "div",
  noteStart: "div",
  notes: "div",
  root: "div",
  row: "div",
  rows: "div",
  selectionSpan: "div",
  stretchEnd: "div",
  stretchStart: "div",
  velocity: "div",
  velocityInput: "input",
  velocityLane: "div",
});

type Naming = {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type NotesProps = {
  /** Draws one note: a `PianoRoll.Note`. */
  children: (note: NoteValue) => ReactNode;
};

/** The notes, in reading order: a note moved past another keeps its place in the DOM while it is dragged. */
function Notes({ children }: NotesProps) {
  return (
    <parts.Notes>
      {({ notes }: { notes: readonly NoteValue[] }) =>
        notes.map((note) => <Fragment key={note.id}>{children(note)}</Fragment>)
      }
    </parts.Notes>
  );
}

type RowsProps = {
  /** Draws the row of one pitch: a `PianoRoll.Row`. */
  children: (pitch: number) => ReactNode;
};

/** The rows, one for each pitch drawn, highest first. */
function Rows({ children }: RowsProps) {
  return (
    <parts.Rows>
      {({ pitches }: { pitches: readonly number[] }) =>
        pitches.map((pitch) => (
          <Fragment key={pitch}>{children(pitch)}</Fragment>
        ))
      }
    </parts.Rows>
  );
}

type NoteProps = Omit<ComponentProps<typeof parts.Note>, "note"> & {
  /** The note this draws. */
  note: NoteValue;
};

/** One note on the roll: it moves by dragging its body, and the keys, and is a button that selects it. */
function Note({ note, ...props }: NoteProps) {
  return <parts.Note {...props} note={note.id} />;
}

type NoteHandleProps = Omit<ComponentProps<typeof parts.NoteStart>, "note"> & {
  /** The edge of the note this resizes. */
  edge: "end" | "start";
  note: NoteValue;
};

/** Resizes one edge of a note by dragging. */
function NoteHandle({ edge, note, ...props }: NoteHandleProps) {
  const Handle = edge === "start" ? parts.NoteStart : parts.NoteEnd;
  return <Handle {...(props as object)} note={note.id} />;
}

type VelocityProps = Omit<ComponentProps<typeof parts.Velocity>, "note"> &
  Naming & {
    children?: ReactNode;
    getAriaValueText?: (velocity: number) => string;
    note: NoteValue;
  };

/** A bar under a note, in a `VelocityLane`: its height is the note's velocity, or its chance, which a drag or the keys set through its native input. */
function Velocity({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  getAriaValueText,
  level,
  note,
  ...props
}: VelocityProps) {
  return (
    <parts.Velocity {...props} level={level} note={note.id}>
      {children}
      <parts.VelocityInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
        level={level}
        note={note.id}
      />
    </parts.Velocity>
  );
}

type StretchHandleProps = Omit<
  ComponentProps<typeof parts.StretchStart>,
  "children"
> & {
  /** The edge of the selection this stretches from. */
  edge: "end" | "start";
};

/** Stretches the selected notes from one edge of their span. Place it inside a `SelectionSpan`. */
function StretchHandle({ edge, ...props }: StretchHandleProps) {
  const Handle = edge === "start" ? parts.StretchStart : parts.StretchEnd;
  return <Handle {...(props as object)} />;
}

export const PianoRoll = {
  Grid: parts.Grid,
  Keys: parts.Keys,
  Marquee: parts.Marquee,
  Note,
  NoteHandle,
  Notes,
  Root: parts.Root,
  Row: parts.Row,
  Rows,
  SelectionSpan: parts.SelectionSpan,
  StretchHandle,
  Velocity,
  VelocityLane: parts.VelocityLane,
};
