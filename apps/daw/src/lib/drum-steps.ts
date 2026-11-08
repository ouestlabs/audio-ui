import type { Note } from "@audio-ui/core/piano-roll";

/** A row and a step of a grid. */
export interface StepCell {
  row: number;
  step: number;
}

/** The steps a clip is seen on: a row per pad, by its note, top to bottom, `steps` steps `step` long from `start`, such as its loop's start. */
export interface StepGrid {
  notes: readonly number[];
  /** Where the first step starts, in the clip's source. @default 0 */
  start?: number;
  step: number;
  steps: number;
}

/** What each step of each row plays: a row per pad, a value per step. */
export interface Steps {
  /** How likely the step is to play each time round, 0 to 1: its first note's. */
  chances: number[][];
  /** Whether a note starts in the step. */
  pattern: boolean[][];
  /** How late the step's first note starts in it, as a share of a step: 0 on the grid. */
  shifts: number[][];
  /** How hard the step plays, 0 to 1: its loudest note's. */
  velocities: number[][];
}

/** What the lane under the steps sets on a step's notes. */
export type StepLevel = "chance" | "shift" | "velocity";

/** The latest a step's note can be shifted, as a share of the step. */
export const MAX_SHIFT = 0.5;

/** How hard a step switched on plays. */
export const STEP_VELOCITY = 0.8;

/** A sliver of a step: a note this close before a step's start is in it, for times that come from sums. */
const EDGE = 1e-6;

/** The step a time starts in. */
const stepAt = (time: number, grid: StepGrid) =>
  Math.floor((time - (grid.start ?? 0) + grid.step * EDGE) / grid.step);

/** Where the step `step` starts. */
const timeOf = (step: number, grid: StepGrid) =>
  (grid.start ?? 0) + step * grid.step;

/** Where a note sits on the grid: its row and its step, or nothing when no pad answers it or it starts past the last step. */
function cellOf(note: Note, grid: StepGrid): StepCell | undefined {
  const row = grid.notes.indexOf(note.pitch);
  const step = stepAt(note.start, grid);
  return row === -1 || step < 0 || step >= grid.steps
    ? undefined
    : { row, step };
}

const inCell = (note: Note, grid: StepGrid, cell: StepCell) => {
  const at = cellOf(note, grid);
  return at?.row === cell.row && at.step === cell.step;
};

const filled = (grid: StepGrid, value: number) =>
  grid.notes.map(() => Array.from({ length: grid.steps }, () => value));

/** The steps the notes play on `grid`. */
export function stepsOf(notes: readonly Note[], grid: StepGrid): Steps {
  const pattern = grid.notes.map(() =>
    Array.from({ length: grid.steps }, () => false)
  );
  const velocities = filled(grid, STEP_VELOCITY);
  const chances = filled(grid, 1);
  const shifts = filled(grid, 0);
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const cell = cellOf(note, grid);
    if (!cell) {
      continue;
    }
    const { row, step } = cell;
    const first = !pattern[row]?.[step];
    const velocity = note.velocity ?? 1;
    (pattern[row] as boolean[])[step] = true;
    (velocities[row] as number[])[step] = first
      ? velocity
      : Math.max(velocity, velocities[row]?.[step] ?? 0);
    if (first) {
      (chances[row] as number[])[step] = note.chance ?? 1;
      (shifts[row] as number[])[step] = Math.max(
        0,
        (note.start - timeOf(step, grid)) / grid.step
      );
    }
  }
  return { chances, pattern, shifts, velocities };
}

/** An id no note in `notes` has. */
function freshId(notes: readonly Note[]): Note["id"] {
  const taken = new Set(notes.map((note) => String(note.id)));
  let next = notes.length + 1;
  while (taken.has(String(next))) {
    next += 1;
  }
  return next;
}

/** A note a step long on the pad of `cell`, at the start of its step. */
const stepNote = (
  notes: readonly Note[],
  grid: StepGrid,
  { row, step }: StepCell,
  velocity: number
): Note => ({
  id: freshId(notes),
  length: grid.step,
  pitch: grid.notes[row] ?? 0,
  start: timeOf(step, grid),
  velocity,
});

/**
 * The notes with the step `cell` switched on, a note a step long added on its
 * pad, or off, every note in it taken away; the same notes when it already
 * is so.
 */
export function withStep(
  notes: readonly Note[],
  grid: StepGrid,
  cell: StepCell,
  on: boolean,
  velocity = STEP_VELOCITY
): readonly Note[] {
  const playing = notes.some((note) => inCell(note, grid, cell));
  if (on === playing) {
    return notes;
  }
  return on
    ? [...notes, stepNote(notes, grid, cell, velocity)]
    : notes.filter((note) => !inCell(note, grid, cell));
}

/**
 * The notes with what the lane sets on the step `cell`: its notes' velocity
 * or chance, 0 to 1, or how late they start, as a share of a step up to
 * `MAX_SHIFT`.
 */
export function withStepLevel(
  notes: readonly Note[],
  grid: StepGrid,
  cell: StepCell,
  level: StepLevel,
  value: number
): readonly Note[] {
  return notes.map((note) => {
    if (!inCell(note, grid, cell)) {
      return note;
    }
    if (level === "shift") {
      const shift = Math.min(MAX_SHIFT, Math.max(0, value));
      return { ...note, start: timeOf(cell.step + shift, grid) };
    }
    return { ...note, [level]: Math.min(1, Math.max(0, value)) };
  });
}

/** The notes with the row `row` playing every `every` steps from the first, and nothing else. */
export function filledEvery(
  notes: readonly Note[],
  grid: StepGrid,
  row: number,
  every: number,
  velocity = STEP_VELOCITY
): readonly Note[] {
  const pitch = grid.notes[row];
  let next = notes.filter(
    (note) => note.pitch !== pitch || cellOf(note, grid) === undefined
  );
  for (let step = 0; step < grid.steps; step += Math.max(1, every)) {
    next = [...next, stepNote(next, grid, { row, step }, velocity)];
  }
  return next;
}