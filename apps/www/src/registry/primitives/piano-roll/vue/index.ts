import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, Fragment, h } from "vue";
import { type Note as NoteValue, pianoRoll } from "@/primitives/piano-roll";

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

const NAMING = ["aria-describedby", "aria-label", "aria-labelledby"] as const;

/** The accessible name given to a part goes to the input it holds. */
const nameOf = (attrs: Record<string, unknown>) => {
  const naming: Record<string, unknown> = {};
  const rest: Record<string, unknown> = { ...attrs };
  for (const key of NAMING) {
    naming[key] = rest[key];
    delete rest[key];
  }
  return { naming, rest };
};

/** The notes, in reading order: its default slot draws one, given `{ note }`. */
const Notes = defineComponent(
  (_props, { slots }) =>
    () =>
      h(parts.Notes, null, {
        default: ({ state }: { state: { notes: readonly NoteValue[] } }) =>
          state.notes.map((note) =>
            h(Fragment, { key: note.id }, slots.default?.({ note }))
          ),
      }),
  { name: "PianoRollNotes" }
);

/** The rows, one for each pitch drawn, highest first: its default slot draws one, given `{ pitch }`. */
const Rows = defineComponent(
  (_props, { slots }) =>
    () =>
      h(parts.Rows, null, {
        default: ({ state }: { state: { pitches: readonly number[] } }) =>
          state.pitches.map((pitch) =>
            h(Fragment, { key: pitch }, slots.default?.({ pitch }))
          ),
      }),
  { name: "PianoRollRows" }
);

/** One note on the roll: it moves by dragging its body, and the keys, and is a button that selects it. */
const Note = defineComponent(
  (props: { note: NoteValue }, { attrs, slots }) =>
    () =>
      h(parts.Note, { ...attrs, note: props.note.id } as never, slots),
  { inheritAttrs: false, name: "PianoRollNote", props: ["note"] }
);

/** Resizes one edge of a note by dragging. */
const NoteHandle = defineComponent(
  (props: { edge: "end" | "start"; note: NoteValue }, { attrs, slots }) =>
    () =>
      h(
        props.edge === "start" ? parts.NoteStart : parts.NoteEnd,
        { ...attrs, note: props.note.id } as never,
        slots
      ),
  { inheritAttrs: false, name: "PianoRollNoteHandle", props: ["edge", "note"] }
);

/** A bar under a note, in a `VelocityLane`: its height is the note's velocity, or its chance, which a drag or the keys set through its native input. */
const Velocity = defineComponent(
  (
    props: {
      getAriaValueText?: (velocity: number) => string;
      level?: string;
      note: NoteValue;
    },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      return h(
        parts.Velocity,
        { ...rest, level: props.level, note: props.note.id } as never,
        {
          default: (scope: object) => [
            slots.default?.(scope),
            h(parts.VelocityInput, {
              ...naming,
              getAriaValueText: props.getAriaValueText,
              level: props.level,
              note: props.note.id,
            } as never),
          ],
        }
      );
    },
  {
    inheritAttrs: false,
    name: "PianoRollVelocity",
    props: ["getAriaValueText", "level", "note"],
  }
);

/** Stretches the selected notes from one edge of their span. Place it inside a `SelectionSpan`. */
const StretchHandle = defineComponent(
  (props: { edge: "end" | "start" }, { attrs, slots }) =>
    () =>
      h(
        props.edge === "start" ? parts.StretchStart : parts.StretchEnd,
        attrs as never,
        slots
      ),
  { inheritAttrs: false, name: "PianoRollStretchHandle", props: ["edge"] }
);

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
