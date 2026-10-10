import { type Grid, snapMove } from "../../timeline/internal/snap";

export type NoteId = number | string;

export interface Note {
  id: NoteId;
  /** Length, in the timeline's units. */
  length: number;
  /** MIDI pitch: 60 is middle C. */
  pitch: number;
  /** Where the note starts, in the timeline's units. */
  start: number;
  /** How hard the note is played, 0…1. @default 1 */
  velocity?: number;
}

export interface RollBounds {
  duration: number;
  maxPitch: number;
  minLength: number;
  minPitch: number;
}

/** Keeps a note on the roll: inside the timeline, in the pitch range, at least `minLength` long. */
export function sanitizeNote(note: Note, bounds: RollBounds): Note {
  const length = Math.min(
    bounds.duration,
    Math.max(bounds.minLength, Number.isFinite(note.length) ? note.length : 0)
  );
  return {
    ...note,
    length,
    pitch: Math.min(
      bounds.maxPitch,
      Math.max(bounds.minPitch, Math.round(note.pitch))
    ),
    start: Math.min(
      bounds.duration - length,
      Math.max(0, Number.isFinite(note.start) ? note.start : 0)
    ),
    velocity: Math.min(1, Math.max(0, note.velocity ?? 1)),
  };
}

/**
 * Moves the notes in `ids` by the same amount, in time and in pitch, so a
 * chord keeps its spacing. The whole group stops where its most restricted
 * note would leave the roll, rather than squashing against the edge.
 */
export function moveNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  deltaStart: number,
  deltaPitch: number,
  bounds: RollBounds
): Note[] {
  const moving = notes.filter((note) => ids.has(note.id));
  if (moving.length === 0) {
    return [...notes];
  }
  const earliest = Math.min(...moving.map((note) => note.start));
  const latestEnd = Math.max(...moving.map((note) => note.start + note.length));
  const lowest = Math.min(...moving.map((note) => note.pitch));
  const highest = Math.max(...moving.map((note) => note.pitch));
  const time = Math.min(
    bounds.duration - latestEnd,
    Math.max(-earliest, deltaStart)
  );
  const pitch = Math.min(
    bounds.maxPitch - highest,
    Math.max(bounds.minPitch - lowest, Math.round(deltaPitch))
  );
  return notes.map((note) =>
    ids.has(note.id)
      ? { ...note, pitch: note.pitch + pitch, start: note.start + time }
      : note
  );
}

/**
 * Moves one edge of every note in `ids` by `delta`: the end makes them
 * longer or shorter, the start trims them from the front while their end
 * stays put. None gets shorter than `minLength` or leaves the timeline.
 */
export function resizeNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  edge: "end" | "start",
  delta: number,
  bounds: RollBounds
): Note[] {
  const resizing = notes.filter((note) => ids.has(note.id));
  if (resizing.length === 0) {
    return [...notes];
  }
  let amount = delta;
  for (const note of resizing) {
    if (edge === "end") {
      amount = Math.max(amount, bounds.minLength - note.length);
      amount = Math.min(amount, bounds.duration - note.start - note.length);
    } else {
      amount = Math.min(amount, note.length - bounds.minLength);
      amount = Math.max(amount, -note.start);
    }
  }
  return notes.map((note) => {
    if (!ids.has(note.id)) {
      return note;
    }
    return edge === "end"
      ? { ...note, length: note.length + amount }
      : { ...note, length: note.length - amount, start: note.start + amount };
  });
}

/** How far the edge of `note` moves when dragged by `delta`, on the grid unless `grid.step` is 0. */
export function snapEdgeDelta(
  note: Note,
  edge: "end" | "start",
  delta: number,
  grid: Grid
): number {
  const from = edge === "end" ? note.start + note.length : note.start;
  return snapMove(from + delta, from, grid) - from;
}

/**
 * Copies of the notes in `ids`, under new ids from `nextId`, left where the
 * originals are. `copyOf` maps each original's id to its copy's.
 */
export function duplicateNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  nextId: () => NoteId
): { copyOf: Map<NoteId, NoteId>; notes: Note[] } {
  const copyOf = new Map<NoteId, NoteId>();
  const copies: Note[] = [];
  for (const note of notes) {
    if (ids.has(note.id)) {
      const id = nextId();
      copyOf.set(note.id, id);
      copies.push({ ...note, id });
    }
  }
  return { copyOf, notes: [...notes, ...copies] };
}

/** The ids of the notes overlapping a stretch of time and a band of rows. */
export function notesWithin(
  notes: readonly Note[],
  area: { end: number; firstRow: number; lastRow: number; start: number },
  rowOf: (pitch: number) => number
): NoteId[] {
  return notes
    .filter((note) => {
      const row = rowOf(note.pitch);
      return (
        note.start < area.end &&
        note.start + note.length > area.start &&
        row >= area.firstRow &&
        row <= area.lastRow
      );
    })
    .map((note) => note.id);
}

/** Notes in the order the eye reads them: left to right, then top to bottom. */
export function spatialOrder(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => a.start - b.start || b.pitch - a.pitch);
}

/** Whether two lists hold the same notes, in the same order. */
export function sameNotes(a: readonly Note[], b: readonly Note[]): boolean {
  return (
    a.length === b.length &&
    a.every((note, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        note.id === other.id &&
        note.pitch === other.pitch &&
        note.start === other.start &&
        note.length === other.length &&
        note.velocity === other.velocity
      );
    })
  );
}

/** The start of the grid cell `value` falls in: where a note drawn there begins. */
export function cellStart(value: number, grid: Grid): number {
  if (!(grid.step > 0)) {
    return value;
  }
  return (
    Math.floor((value - grid.offset) / grid.step) * grid.step + grid.offset
  );
}

/** Shift + Arrow Up/Down moves notes by an octave. */
const OCTAVE = 12;

/**
 * What an arrow key does to the notes in `ids`: Left and Right move them by
 * `step`, or with Shift change their length; Up and Down move them by a
 * semitone, or with Shift an octave. Any other key does nothing.
 */
export function keyboardEdit(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  key: string,
  shiftKey: boolean,
  step: number,
  bounds: RollBounds
): { edit: "move" | "resize"; notes: Note[] } | null {
  const direction = key === "ArrowRight" || key === "ArrowUp" ? 1 : -1;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return shiftKey
      ? {
          edit: "resize",
          notes: resizeNotes(notes, ids, "end", direction * step, bounds),
        }
      : {
          edit: "move",
          notes: moveNotes(notes, ids, direction * step, 0, bounds),
        };
  }
  if (key === "ArrowUp" || key === "ArrowDown") {
    const semitones = direction * (shiftKey ? OCTAVE : 1);
    return { edit: "move", notes: moveNotes(notes, ids, 0, semitones, bounds) };
  }
  return null;
}
