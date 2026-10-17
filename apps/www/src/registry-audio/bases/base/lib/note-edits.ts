import {
  chopNotes,
  deleteTime,
  duplicateTime,
  fitNotesToScale,
  humanizeNotes,
  insertTime,
  invertNotes,
  joinNotes,
  legatoNotes,
  type Note,
  type NoteId,
  quantizeNotes,
  type RollBounds,
  rampVelocity,
  reverseNotes,
  selectionSpan,
  setChance,
  splitNotes,
  stretchNotes,
  toggleMuted,
} from "@audio-ui/core/piano-roll";
import type { Scale } from "@audio-ui/core/pitch";

/** What an edit knows of the editor it runs in. */
export interface NoteEditContext {
  /** Where the playhead is, in steps. */
  at: number;
  /** The roll's range: its length, its pitches, and the shortest a note gets from an edit. */
  bounds: RollBounds;
  /** Where the loop ends, in steps: what legato stretches the last notes to. */
  loopEnd: number;
  /** A new id, for each note an edit makes. */
  nextId: () => NoteId;
  /** The scale marked on the roll, which "Fit to scale" needs. */
  scale: Scale | null;
  /** Whether notes are selected, rather than the edit taking every note. */
  selected: boolean;
}

/** One command over notes: a menu item, and perhaps a key. */
export interface NoteEdit {
  edit: (notes: Note[], ids: Set<NoteId>, context: NoteEditContext) => Note[];
  id: string;
  label: string;
  /** Whether the edit needs a scale marked on the roll. */
  needsScale?: boolean;
  /** Whether the edit works on the time the selection covers, so needs one. */
  needsSelection?: boolean;
  /** The key shown beside the label, such as `⌘E`. */
  shortcut?: string;
}

/** Every step of a clip: the times a chop to the grid cuts at. */
const gridLines = (duration: number) =>
  Array.from({ length: duration }, (_, step) => step);

/** The time the selected notes cover, as a time command reads it. */
const spanOf = (notes: Note[], ids: Set<NoteId>) =>
  selectionSpan(notes, ids) ?? { end: 0, start: 0 };

/** Edits that change when the notes play and how long they last. */
export const TIME_EDITS: NoteEdit[] = [
  {
    // Selected notes chop on the grid; with none, the notes crossing the playhead split there.
    edit: (notes, ids, { at, bounds, nextId, selected }) =>
      splitNotes(notes, ids, selected ? gridLines(bounds.duration) : at, nextId)
        .notes,
    id: "split",
    label: "Split",
    shortcut: "⌘E",
  },
  {
    edit: (notes, ids, { bounds, nextId }) =>
      chopNotes(notes, ids, 2, nextId, bounds.minLength).notes,
    id: "chop",
    label: "Chop in two",
  },
  {
    edit: (notes, ids) => joinNotes(notes, ids),
    id: "join",
    label: "Join",
    shortcut: "⌘J",
  },
  {
    edit: (notes, ids, { bounds }) =>
      quantizeNotes(notes, ids, Math.round, bounds),
    id: "quantize",
    label: "Quantize",
    shortcut: "⌘U",
  },
  {
    edit: (notes, ids, { bounds, loopEnd }) =>
      legatoNotes(notes, ids, bounds.minLength, loopEnd),
    id: "legato",
    label: "Legato",
  },
  {
    edit: (notes, ids) => reverseNotes(notes, ids),
    id: "reverse",
    label: "Reverse",
  },
  {
    edit: (notes, ids, { bounds }) => stretchNotes(notes, ids, 2, bounds),
    id: "double",
    label: "Twice as long",
  },
  {
    edit: (notes, ids, { bounds }) => stretchNotes(notes, ids, 0.5, bounds),
    id: "half",
    label: "Half as long",
  },
  {
    edit: (notes, ids, { bounds, nextId }) => {
      const { end, start } = spanOf(notes, ids);
      return duplicateTime(notes, start, end, nextId, bounds.duration).notes;
    },
    id: "duplicate-time",
    label: "Duplicate time",
    needsSelection: true,
    shortcut: "⇧⌘D",
  },
  {
    edit: (notes, ids) => {
      const { end, start } = spanOf(notes, ids);
      return deleteTime(notes, start, end);
    },
    id: "delete-time",
    label: "Delete time",
    needsSelection: true,
    shortcut: "⇧⌘⌫",
  },
  {
    edit: (notes, ids, { bounds, nextId }) => {
      const { end, start } = spanOf(notes, ids);
      return insertTime(notes, start, end - start, nextId, bounds.duration);
    },
    id: "insert-time",
    label: "Insert time",
    needsSelection: true,
    shortcut: "⌘I",
  },
];

/** Edits that change the notes' pitches. */
export const PITCH_EDITS: NoteEdit[] = [
  {
    edit: (notes, ids) => invertNotes(notes, ids),
    id: "invert",
    label: "Invert",
  },
  {
    edit: (notes, ids, { bounds, scale }) =>
      scale ? fitNotesToScale(notes, ids, scale, bounds) : notes,
    id: "fit",
    label: "Fit to scale",
    needsScale: true,
  },
];

/** Whether and how often the notes play: deactivated stays on the roll, silent. */
export const PLAY_EDITS: NoteEdit[] = [
  {
    edit: (notes, ids) => toggleMuted(notes, ids),
    id: "mute",
    label: "Deactivate",
    shortcut: "0",
  },
  ...[1, 0.75, 0.5, 0.25].map((chance) => ({
    edit: (notes: Note[], ids: Set<NoteId>) => setChance(notes, ids, chance),
    id: `chance-${chance}`,
    label: chance === 1 ? "Always play" : `Play ${chance * 100}% of the time`,
  })),
];

/** Edits that change how hard the notes play. */
export const VELOCITY_EDITS: NoteEdit[] = [
  {
    edit: (notes, ids) => rampVelocity(notes, ids, 0.3, 1),
    id: "crescendo",
    label: "Crescendo",
  },
  {
    edit: (notes, ids) => rampVelocity(notes, ids, 1, 0.3),
    id: "decrescendo",
    label: "Decrescendo",
  },
  {
    edit: (notes, ids, { bounds }) =>
      humanizeNotes(notes, ids, { timing: 0.25, velocity: 0.15 }, bounds),
    id: "humanize",
    label: "Humanize",
  },
];

const ALL_EDITS = [
  ...TIME_EDITS,
  ...PITCH_EDITS,
  ...PLAY_EDITS,
  ...VELOCITY_EDITS,
];
const editById = (id: string) => ALL_EDITS.find((item) => item.id === id);

/** Cmd/Ctrl with a letter: the edits that have a key of their own. */
const EDITS_BY_KEY: Record<string, NoteEdit | undefined> = {
  e: editById("split"),
  i: editById("insert-time"),
  j: editById("join"),
  u: editById("quantize"),
};
/** Cmd/Ctrl + Shift with a key: the time commands. */
const SHIFT_EDITS_BY_KEY: Record<string, NoteEdit | undefined> = {
  backspace: editById("delete-time"),
  d: editById("duplicate-time"),
  delete: editById("delete-time"),
};

/** The edit Cmd/Ctrl (and Shift) with `key` runs, if any. `key` is lower case. */
export function noteEditForKey(
  key: string,
  shiftKey: boolean
): NoteEdit | undefined {
  return shiftKey ? SHIFT_EDITS_BY_KEY[key] : EDITS_BY_KEY[key];
}

/** Whether `edit` can run now: there are notes, and the selection or the scale it needs. */
export function canApplyNoteEdit(
  edit: NoteEdit,
  state: { hasNotes: boolean; hasScale: boolean; hasSelection: boolean }
): boolean {
  return (
    state.hasNotes &&
    (!edit.needsScale || state.hasScale) &&
    (!edit.needsSelection || state.hasSelection)
  );
}

/** Runs `edit` on the selected notes, or on every note with none selected. */
export function applyNoteEdit(
  edit: NoteEdit,
  notes: Note[],
  selection: readonly NoteId[],
  context: Omit<NoteEditContext, "selected">
): Note[] {
  const selected = selection.length > 0;
  const ids = new Set(selected ? selection : notes.map((note) => note.id));
  return edit.edit(notes, ids, { ...context, selected });
}
