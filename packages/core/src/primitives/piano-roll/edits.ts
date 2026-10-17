import { nearestInScale, type Scale } from "../../audio/pitch/scale.ts";
import { type Grid, snapMove } from "../timeline/snap.ts";

export type NoteId = number | string;

export interface Note {
  /** How likely the note is to play each time it comes round, 0…1. @default 1 */
  chance?: number;
  id: NoteId;
  /** Length, in the timeline's units. */
  length: number;
  /** Whether the note is deactivated: it stays on the roll, and does not play. @default false */
  muted?: boolean;
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

/**
 * Copies of the notes in `ids` placed right after them, one selection's
 * length on, so a phrase repeats itself the way it is played. They stop where
 * the roll ends; with no room for even a step, nothing is copied.
 */
export function duplicateAfter(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  nextId: () => NoteId,
  bounds: RollBounds
): { copies: NoteId[]; notes: Note[] } | null {
  const source = notes.filter((note) => ids.has(note.id));
  if (source.length === 0) {
    return null;
  }
  const earliest = Math.min(...source.map((note) => note.start));
  const latestEnd = Math.max(...source.map((note) => note.start + note.length));
  const shift = Math.min(latestEnd - earliest, bounds.duration - latestEnd);
  if (shift < bounds.minLength) {
    return null;
  }
  const copies = source.map((note) => ({
    ...note,
    id: nextId(),
    start: note.start + shift,
  }));
  return {
    copies: copies.map((note) => note.id),
    notes: [...notes, ...copies],
  };
}

/** The notes in `ids` with their start on the nearest grid line: their length, and the rest, stay. */
export function quantizeNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  snap: (value: number) => number,
  bounds: RollBounds
): Note[] {
  return notes.map((note) => {
    if (!ids.has(note.id)) {
      return note;
    }
    const start = Math.min(
      bounds.duration - note.length,
      Math.max(0, snap(note.start))
    );
    return start === note.start ? note : { ...note, start };
  });
}

/**
 * Copies of `clipboard` under new ids, the earliest starting at `at`: a phrase
 * keeps its spacing wherever it lands, and stops where the roll ends.
 */
export function pasteNotes(
  notes: readonly Note[],
  clipboard: readonly Note[],
  at: number,
  nextId: () => NoteId,
  bounds: RollBounds
): { pasted: NoteId[]; notes: Note[] } | null {
  if (clipboard.length === 0) {
    return null;
  }
  const earliest = Math.min(...clipboard.map((note) => note.start));
  const latestEnd = Math.max(
    ...clipboard.map((note) => note.start + note.length)
  );
  const shift = Math.max(
    -earliest,
    Math.min(at - earliest, bounds.duration - latestEnd)
  );
  const pasted = clipboard.map((note) => ({
    ...note,
    id: nextId(),
    start: note.start + shift,
  }));
  return {
    notes: [...notes, ...pasted],
    pasted: pasted.map((note) => note.id),
  };
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
        note.velocity === other.velocity &&
        note.muted === other.muted &&
        note.chance === other.chance
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

/**
 * Changes the velocity of every note in `ids` by `delta`, each kept within
 * 0…1: a phrase keeps its dynamics, where setting them all to one value
 * would flatten it.
 */
export function changeVelocity(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  delta: number
): Note[] {
  return notes.map((note) =>
    ids.has(note.id)
      ? {
          ...note,
          velocity: Math.min(1, Math.max(0, (note.velocity ?? 1) + delta)),
        }
      : note
  );
}

/** The notes in `ids`, with the earliest start and the latest end among them. */
function span(notes: readonly Note[], ids: ReadonlySet<NoteId>) {
  const chosen = notes.filter((note) => ids.has(note.id));
  return {
    chosen,
    earliest: Math.min(...chosen.map((note) => note.start)),
    latestEnd: Math.max(...chosen.map((note) => note.start + note.length)),
  };
}

/** Cuts a note at each time in `at` it holds: the first piece keeps its id, the others take new ones. */
function cut(note: Note, at: readonly number[], nextId: () => NoteId): Note[] {
  const end = note.start + note.length;
  const times = at.filter((time) => time > note.start && time < end);
  const edges = [note.start, ...times, end];
  return edges.slice(0, -1).map((start, index) => ({
    ...note,
    id: index === 0 ? note.id : nextId(),
    length: (edges[index + 1] as number) - start,
    start,
  }));
}

function cutNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  timesOf: (note: Note) => number[],
  nextId: () => NoteId
): { added: NoteId[]; notes: Note[] } {
  const added: NoteId[] = [];
  const next = notes.flatMap((note) => {
    if (!ids.has(note.id)) {
      return [note];
    }
    const pieces = cut(note, timesOf(note), nextId);
    added.push(...pieces.slice(1).map((piece) => piece.id));
    return pieces;
  });
  return { added, notes: next };
}

/**
 * Splits the notes in `ids` at `at`, or at each time in it, wherever a note
 * holds that time: the first piece keeps the note's id, the others take new
 * ones. Every grid line as `at` chops the notes to the grid. `added` lists
 * the new ids.
 */
export function splitNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  at: number | readonly number[],
  nextId: () => NoteId
): { added: NoteId[]; notes: Note[] } {
  const times = typeof at === "number" ? [at] : at;
  return cutNotes(notes, ids, () => [...times], nextId);
}

/**
 * Chops each note in `ids` into `parts` notes of the same length, as many as
 * fit at `minLength` or longer: a held note becomes a repeated one.
 */
export function chopNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  parts: number,
  nextId: () => NoteId,
  minLength: number
): { added: NoteId[]; notes: Note[] } {
  return cutNotes(
    notes,
    ids,
    (note) => {
      const count = Math.max(
        1,
        Math.min(Math.floor(parts), Math.floor(note.length / minLength))
      );
      const piece = note.length / count;
      return Array.from(
        { length: count - 1 },
        (_, index) => note.start + piece * (index + 1)
      );
    },
    nextId
  );
}

/**
 * Joins the notes in `ids` that share a pitch into one, from the earliest
 * start to the latest end: the earliest keeps its id and velocity.
 */
export function joinNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>
): Note[] {
  const joined = new Map<number, Note>();
  for (const note of spatialOrder(notes)) {
    if (!ids.has(note.id)) {
      continue;
    }
    const first = joined.get(note.pitch);
    joined.set(
      note.pitch,
      first
        ? {
            ...first,
            length:
              Math.max(first.start + first.length, note.start + note.length) -
              first.start,
          }
        : note
    );
  }
  const kept = new Set([...joined.values()].map((note) => note.id));
  return notes.flatMap((note) => {
    if (!ids.has(note.id)) {
      return [note];
    }
    return kept.has(note.id) ? [joined.get(note.pitch) as Note] : [];
  });
}

/**
 * Lengthens or shortens each note in `ids` to end where the next of them
 * starts, so a phrase plays without gaps. The notes that start last reach
 * `end`, such as where the loop ends, or keep their length without one.
 */
export function legatoNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  minLength: number,
  end?: number
): Note[] {
  const starts = [
    ...new Set(
      notes.filter((note) => ids.has(note.id)).map((note) => note.start)
    ),
  ].sort((a, b) => a - b);
  return notes.map((note) => {
    const next =
      starts.find((start) => start > note.start) ??
      (end !== undefined && end > note.start ? end : undefined);
    return ids.has(note.id) && next !== undefined
      ? { ...note, length: Math.max(minLength, next - note.start) }
      : note;
  });
}

/** Plays the notes in `ids` backwards: each lands where it would end, mirrored across their span. */
export function reverseNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>
): Note[] {
  const { chosen, earliest, latestEnd } = span(notes, ids);
  if (chosen.length === 0) {
    return [...notes];
  }
  return notes.map((note) =>
    ids.has(note.id)
      ? { ...note, start: earliest + latestEnd - note.start - note.length }
      : note
  );
}

/** Turns the notes in `ids` upside down: the highest becomes the lowest, around the middle of their range. */
export function invertNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>
): Note[] {
  const chosen = notes.filter((note) => ids.has(note.id));
  if (chosen.length === 0) {
    return [...notes];
  }
  const sum =
    Math.min(...chosen.map((note) => note.pitch)) +
    Math.max(...chosen.map((note) => note.pitch));
  return notes.map((note) =>
    ids.has(note.id) ? { ...note, pitch: sum - note.pitch } : note
  );
}

/**
 * Makes the notes in `ids` `factor` times as long, from where the earliest
 * starts: 2 plays them at half the speed, 0.5 at twice. The factor stops
 * where the last would leave the roll, and no note gets shorter than
 * `minLength`.
 */
export function stretchNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  factor: number,
  bounds: RollBounds
): Note[] {
  const { chosen, earliest, latestEnd } = span(notes, ids);
  if (chosen.length === 0 || !(Number.isFinite(factor) && factor > 0)) {
    return [...notes];
  }
  const scale = Math.min(
    factor,
    (bounds.duration - earliest) / (latestEnd - earliest)
  );
  return notes.map((note) =>
    ids.has(note.id)
      ? {
          ...note,
          length: Math.max(bounds.minLength, note.length * scale),
          start: earliest + (note.start - earliest) * scale,
        }
      : note
  );
}

/**
 * Moves each note in `ids` that is out of `scale` to the nearest pitch in it,
 * the lower of two as near. One that would leave the roll stays where it is.
 */
export function fitNotesToScale(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  scale: Scale,
  bounds: RollBounds
): Note[] {
  return notes.map((note) => {
    if (!ids.has(note.id)) {
      return note;
    }
    const pitch = nearestInScale(note.pitch, scale);
    return pitch === note.pitch ||
      pitch < bounds.minPitch ||
      pitch > bounds.maxPitch
      ? note
      : { ...note, pitch };
  });
}

/**
 * Sets the velocity of the notes in `ids` along a line, from `from` on the
 * earliest to `to` on the latest: a crescendo, or a fade.
 */
export function rampVelocity(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  from: number,
  to: number
): Note[] {
  const chosen = notes.filter((note) => ids.has(note.id));
  if (chosen.length === 0) {
    return [...notes];
  }
  const first = Math.min(...chosen.map((note) => note.start));
  const last = Math.max(...chosen.map((note) => note.start));
  return notes.map((note) => {
    if (!ids.has(note.id)) {
      return note;
    }
    const at = last > first ? (note.start - first) / (last - first) : 0;
    return {
      ...note,
      velocity: Math.min(1, Math.max(0, from + (to - from) * at)),
    };
  });
}

/**
 * Loosens the notes in `ids` the way a player would: each start moves by up
 * to `timing` either way and each velocity by up to `velocity`, from
 * `random` (0…1, `Math.random` by default). Notes stay on the roll.
 */
export function humanizeNotes(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  amount: { timing: number; velocity: number },
  bounds: RollBounds,
  random: () => number = Math.random
): Note[] {
  return notes.map((note) => {
    if (!ids.has(note.id)) {
      return note;
    }
    const start = note.start + (random() * 2 - 1) * amount.timing;
    const velocity =
      (note.velocity ?? 1) + (random() * 2 - 1) * amount.velocity;
    return {
      ...note,
      start: Math.min(bounds.duration - note.length, Math.max(0, start)),
      velocity: Math.min(1, Math.max(0, velocity)),
    };
  });
}

/**
 * Deactivates the notes in `ids`, or activates them again when every one of
 * them already is: a deactivated note stays on the roll and does not play.
 */
export function toggleMuted(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>
): Note[] {
  const chosen = notes.filter((note) => ids.has(note.id));
  const muted = !chosen.every((note) => note.muted);
  return notes.map((note) => (ids.has(note.id) ? { ...note, muted } : note));
}

/** Sets how likely the notes in `ids` are to play each time round, 0…1: 1 always, 0.5 every other time on average. */
export function setChance(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>,
  chance: number
): Note[] {
  const value = Math.min(1, Math.max(0, chance));
  return notes.map((note) =>
    ids.has(note.id) ? { ...note, chance: value } : note
  );
}

/** The time the notes in `ids` cover, from the earliest start to the latest end, or null with none. */
export function selectionSpan(
  notes: readonly Note[],
  ids: ReadonlySet<NoteId>
): { end: number; start: number } | null {
  const chosen = notes.filter((note) => ids.has(note.id));
  if (chosen.length === 0) {
    return null;
  }
  return {
    end: Math.max(...chosen.map((note) => note.start + note.length)),
    start: Math.min(...chosen.map((note) => note.start)),
  };
}
