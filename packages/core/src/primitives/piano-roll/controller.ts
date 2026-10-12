import { followPointer } from "../../dom/gesture";
import { clamp } from "../../shared/math";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events";
import { bypassesGrid, type Grid, snapMove, snapToGrid } from "../timeline";
import {
  cellStart,
  changeVelocity,
  duplicateAfter,
  duplicateNotes,
  keyboardEdit,
  moveNotes,
  type Note,
  type NoteId,
  notesWithin,
  pasteNotes,
  quantizeNotes,
  type RollBounds,
  resizeNotes,
  sameNotes,
  sanitizeNote,
  snapEdgeDelta,
  spatialOrder,
} from "./edits";
import { type Rows, rollRows } from "./rows";

/** How far a pointer moves before a press on the grid or a note becomes a drag. */
export const DRAG_THRESHOLD = 4;
/** What the arrow keys change a velocity by; Page Up/Down move five times as far. */
const VELOCITY_STEP = 0.05;
const VELOCITY_LARGE_STEP = 0.25;
const EMPTY_NOTES: readonly Note[] = [];
const EMPTY_IDS: readonly NoteId[] = [];
const NO_GRID: Grid = { offset: 0, step: 0 };

/** What a change did to the notes. */
export type PianoRollEdit =
  | "add"
  | "duplicate"
  | "move"
  | "paste"
  | "quantize"
  | "remove"
  | "resize"
  | "velocity";

type Edited<Details> = Details & {
  /** What the change did: one gesture keeps one `edit` throughout. */
  edit: PianoRollEdit;
};

export type PianoRollChangeEventDetails =
  | Edited<ChangeEventDetails<"draw" | "drag", PointerEvent>>
  | Edited<ChangeEventDetails<"keyboard", KeyboardEvent>>
  | Edited<ChangeEventDetails<"double-click", MouseEvent>>
  | Edited<ChangeEventDetails<"input-change", Event>>;
export type PianoRollChangeEventReason = PianoRollChangeEventDetails["reason"];
export type PianoRollCommitEventDetails =
  | Edited<CommitEventDetails<"draw" | "drag", PointerEvent>>
  | Edited<CommitEventDetails<"keyboard", KeyboardEvent>>
  | Edited<CommitEventDetails<"double-click", MouseEvent>>
  | Edited<CommitEventDetails<"input-change", Event>>;
export type PianoRollCommitEventReason = PianoRollCommitEventDetails["reason"];

export type PianoRollSelectionEventDetails =
  | ChangeEventDetails<"press" | "marquee" | "draw" | "drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"double-click", MouseEvent>;

type WithVelocity<Details> = Details & {
  /** How hard the note is played, 0…1. */
  velocity: number;
};

/** Why a pitch sounds: a key pressed, glided onto or played from the keyboard, or a note drawn, picked up or moved. */
export type PianoRollNoteOnEventDetails =
  | WithVelocity<ChangeEventDetails<"press" | "glide", PointerEvent>>
  | WithVelocity<ChangeEventDetails<"keyboard", KeyboardEvent>>
  | WithVelocity<ChangeEventDetails<"draw" | "drag", PointerEvent>>;

export type PianoRollNoteOffEventDetails =
  | CommitEventDetails<"press" | "glide" | "draw" | "drag", PointerEvent>
  | CommitEventDetails<"keyboard", FocusEvent | KeyboardEvent>;

/** A key pressed on the keyboard beside the roll, before it sounds. */
export type PianoRollKeyDetails =
  | ChangeEventDetails<"press" | "glide", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>;

/** A selection rectangle, in px from the grid's top left corner. */
export interface PianoRollBand {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** The timeline the roll sits in: its length, grid, zoom and playback position. */
export interface PianoRollTimeline {
  duration: number;
  grid: Grid;
  /** The playback position, in the timeline's units. */
  position: () => number;
  step: number;
  /** Pixels per unit, or null when the timeline fits its lane. */
  zoom: number | null;
}

export interface PianoRollOptions {
  activePitches?: readonly number[];
  /** Returns the id of a note drawn, added or duplicated. Defaults to `"note-<n>"`, skipping ids in use. */
  createNoteId?: () => NoteId;
  defaultSelection?: readonly NoteId[];
  defaultValue?: readonly Note[];
  disabled?: boolean;
  /** Whether only the pitches carrying notes get a row. @default false */
  folded?: boolean;
  /** @default 72 */
  maxPitch?: number;
  /** The shortest a note can be, in the timeline's units. Defaults to the timeline's grid step. */
  minLength?: number;
  /** @default 48 */
  minPitch?: number;
  /** What a press on empty grid does: draw a note, or start a selection rectangle. @default "select" */
  mode?: "draw" | "select";
  onNoteOff?: (pitch: number, details: PianoRollNoteOffEventDetails) => void;
  onNoteOn?: (pitch: number, details: PianoRollNoteOnEventDetails) => void;
  onSelectionChange?: (
    selection: readonly NoteId[],
    details: PianoRollSelectionEventDetails
  ) => void;
  onValueChange?: (value: Note[], details: PianoRollChangeEventDetails) => void;
  onValueCommitted?: (
    value: Note[],
    details: PianoRollCommitEventDetails
  ) => void;
  /** Asks the view to move focus to a note, or to the grid with `null`, once it has rendered. */
  requestFocus?: (target: NoteId | null) => void;
  selection?: readonly NoteId[];
  timeline: PianoRollTimeline;
  value?: readonly Note[];
}

/** What a view draws the roll from. */
export interface PianoRollSnapshot {
  /** Pitches sounding: auditioned here, or listed in `activePitches`. */
  active: ReadonlySet<number>;
  band: PianoRollBand | null;
  bounds: RollBounds;
  disabled: boolean;
  /** Whether a pointer is drawing, moving, resizing or selecting notes. */
  editing: boolean;
  folded: boolean;
  mode: "draw" | "select";
  noteById: ReadonlyMap<NoteId, Note>;
  /** The notes as displayed. */
  notes: readonly Note[];
  rows: Rows;
  selection: ReadonlySet<NoteId>;
}

/** Which pointer handle a note gesture takes: its body, or one of its edges. */
export type PianoRollNoteHandle = "end" | "move" | "start";

export interface PianoRollController {
  /** Adds a note at the playback position, from the keyboard. Returns whether it was added. */
  addAtPlayback: (event: KeyboardEvent) => boolean;
  doubleClickGrid: (event: MouseEvent, grid: Element) => void;
  doubleClickNote: (id: NoteId, event: MouseEvent) => void;
  getSnapshot: () => PianoRollSnapshot;
  /** Handles a key on the grid: a command, Escape clears the selection, Cmd/Ctrl+A selects all. Returns whether it was the grid's. */
  keyGrid: (event: KeyboardEvent) => boolean;
  /** Handles a key on a note: Delete removes, Enter and Space toggle its selection, arrows move it, Shift + arrows resize it. Returns whether it was the note's. */
  keyNote: (id: NoteId, event: KeyboardEvent) => boolean;
  keyOff: (pitch: number, details: PianoRollNoteOffEventDetails) => void;
  /** A key on the keyboard beside the roll: sounds it, or with Shift selects the notes on its row. */
  keyOn: (pitch: number, details: PianoRollKeyDetails) => void;
  /** Handles a key on a velocity's input. Returns whether it was the velocity's. */
  keyVelocity: (id: NoteId, event: KeyboardEvent) => boolean;
  /** Starts a press on the grid: a draw in draw mode, or a selection rectangle. */
  pressGrid: (event: PointerEvent, grid: Element) => void;
  /** Starts a press on a note: a drag moves it, or resizes it from an edge; Alt copies, Shift toggles its selection. */
  pressNote: (
    id: NoteId,
    handle: PianoRollNoteHandle,
    event: PointerEvent,
    element: Element,
    grid: Element
  ) => void;
  /** Starts a press on a velocity bar: a drag changes the velocity of the selection, or of the note. */
  pressVelocity: (
    id: NoteId,
    event: PointerEvent,
    element: Element,
    lane: Element | null
  ) => void;
  /** Stops the pitch a key moved a note to, once the key is released. */
  releaseKey: (event: Event) => void;
  setOptions: (options: PianoRollOptions) => void;
  /** Sets a velocity from an input, reporting an `"input-change"` change and commit. */
  setVelocity: (id: NoteId, velocity: number, event: Event) => void;
  /** Handles a Cmd/Ctrl command: copy, cut, paste, duplicate, quantize. Returns whether it was one. */
  shortcut: (event: KeyboardEvent) => boolean;
  subscribe: (listener: () => void) => () => void;
}

/** One pointer gesture on a note, from press to release. */
interface NoteGesture {
  anchor: Note;
  changed: boolean;
  /** Alt was held: the drag carries copies off and leaves the notes. */
  copy: boolean;
  edit: PianoRollEdit;
  grid: Element;
  handle: PianoRollNoteHandle;
  /** The notes the gesture moves: the selection, or just this note. */
  ids: ReadonlySet<NoteId>;
  /** The notes when the gesture began: every move is measured from them. */
  origin: Note[];
  rowHeight: number;
  /** The rows when the gesture began, which a folded roll changes under it. */
  rows: Rows;
  sounding: number | null;
  started: boolean;
  startX: number;
  startY: number;
}

/** One pointer gesture on the grid: a note drawn to its end, or a selection rectangle. */
type GridGesture =
  | {
      grid: Element;
      id: NoteId;
      kind: "draw";
      sounding: number | null;
      start: number;
      started: boolean;
      startX: number;
      startY: number;
    }
  | {
      /** What was selected before, kept when Shift started the rectangle. */
      base: readonly NoteId[];
      grid: Element;
      kind: "marquee";
      x: number;
      y: number;
    };

interface VelocityGesture {
  changed: boolean;
  /** The lane's height: a drag across all of it goes from silent to full. */
  height: number;
  id: NoteId;
  ids: ReadonlySet<NoteId>;
  origin: Note[];
  startY: number;
}

/** The timeline's units under a point of `element`, clamped to the timeline. */
function timeAt(
  element: Element,
  clientX: number,
  zoom: number | null,
  duration: number
): number {
  const rect = element.getBoundingClientRect();
  const unit = zoom ?? rect.width / Math.max(duration, Number.MIN_VALUE);
  const value = (clientX - rect.left) / Math.max(unit, Number.MIN_VALUE);
  return Math.min(duration, Math.max(0, value));
}

/** Where a gesture puts the notes once the pointer has moved by `units` across and `dy` px down. */
function draggedNotes(
  gesture: NoteGesture,
  units: number,
  dy: number,
  grid: Grid,
  bounds: RollBounds
): Note[] {
  const { anchor, handle } = gesture;
  if (handle !== "move") {
    return resizeNotes(
      gesture.origin,
      gesture.ids,
      handle,
      snapEdgeDelta(anchor, handle, units, grid),
      bounds
    );
  }
  const start = snapMove(anchor.start + units, anchor.start, grid);
  const rows = gesture.rowHeight > 0 ? Math.round(dy / gesture.rowHeight) : 0;
  return moveNotes(
    gesture.origin,
    gesture.ids,
    start - anchor.start,
    gesture.rows.step(anchor.pitch, rows) - anchor.pitch,
    bounds
  );
}

/**
 * A piano roll's behavior with no view attached: its notes, held or
 * controlled, its selection and the pitches sounding, and every gesture and
 * key that edits them.
 */
export function createPianoRollController(
  initial: PianoRollOptions
): PianoRollController {
  let options = initial;
  const bounds = (): RollBounds => {
    const { duration, grid, step } = options.timeline;
    return {
      duration,
      maxPitch: options.maxPitch ?? 72,
      minLength: options.minLength ?? (grid.step > 0 ? grid.step : step),
      minPitch: options.minPitch ?? 48,
    };
  };

  // Notes: held by the roll, unless `value` is given.
  let uncontrolled: readonly Note[] | undefined;
  // Holds the notes a gesture edits until it ends, so a controlled value that
  // lags behind can't pull them back mid-gesture.
  let dragValue: Note[] | null = null;
  let editing = false;
  let sanitizedKey = "";
  let sanitized = new WeakMap<Note, Note>();
  let heldFor: readonly Note[] | null = null;
  let heldValue: readonly Note[] = EMPTY_NOTES;

  // Selection: held by the roll, unless `selection` is given.
  let uncontrolledSelection: readonly NoteId[] | undefined;
  let selectionFor: readonly NoteId[] | null = null;
  let selectionSet: ReadonlySet<NoteId> = new Set();

  // Pitches sounding, and the one a key moved a note to.
  let sounding = new Set<number>();
  let keySounding: number | null = null;
  let band: PianoRollBand | null = null;
  let noteGesture: NoteGesture | null = null;
  let gridGesture: GridGesture | null = null;
  let velocityGesture: VelocityGesture | null = null;
  // The length and velocity a drawn note gets: those last drawn or resized.
  let drawTemplate: { length: number; velocity: number } | null = null;
  let lastPitch: number | null = null;
  let clipboard: readonly Note[] = [];
  let nextId = 0;

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const displayed = (): readonly Note[] => {
    if (dragValue) {
      return dragValue;
    }
    const held =
      options.value ?? uncontrolled ?? options.defaultValue ?? EMPTY_NOTES;
    const key = JSON.stringify(bounds());
    if (held === heldFor && key === sanitizedKey) {
      return heldValue;
    }
    if (key !== sanitizedKey) {
      sanitized = new WeakMap<Note, Note>();
      sanitizedKey = key;
    }
    const limits = bounds();
    heldValue = held.map((note) => {
      const known = sanitized.get(note);
      if (known) {
        return known;
      }
      const next = sanitizeNote(note, limits);
      sanitized.set(note, next);
      return next;
    });
    heldFor = held;
    return heldValue;
  };

  const selectedIds = (): ReadonlySet<NoteId> => {
    const list =
      options.selection ??
      uncontrolledSelection ??
      options.defaultSelection ??
      EMPTY_IDS;
    if (list !== selectionFor) {
      selectionFor = list;
      selectionSet = new Set(list);
    }
    return selectionSet;
  };

  let rowsKey = "";
  let rowsCache: Rows | null = null;
  const rowsFor = (notes: readonly Note[]): Rows => {
    const folded = options.folded ?? false;
    const min = options.minPitch ?? 48;
    const max = options.maxPitch ?? 72;
    // Only folded rows depend on which pitches carry notes.
    const pitchKey = folded
      ? [...new Set(notes.map((note) => note.pitch))]
          .sort((a, b) => a - b)
          .join(",")
      : "";
    const key = `${folded}|${min}|${max}|${pitchKey}`;
    if (!rowsCache || key !== rowsKey) {
      rowsKey = key;
      rowsCache = rollRows(notes, min, max, folded);
    }
    return rowsCache;
  };

  let noteMapFor: readonly Note[] | null = null;
  let noteMap: ReadonlyMap<NoteId, Note> = new Map();
  const noteById = (notes: readonly Note[]) => {
    if (notes !== noteMapFor) {
      noteMapFor = notes;
      noteMap = new Map(notes.map((note) => [note.id, note]));
    }
    return noteMap;
  };

  const activeSet = (): ReadonlySet<number> =>
    new Set([...sounding, ...(options.activePitches ?? [])]);

  let snapshot: PianoRollSnapshot | null = null;
  const getSnapshot = (): PianoRollSnapshot => {
    const notes = displayed();
    const selection = selectedIds();
    const active = activeSet();
    const limits = bounds();
    const rows = rowsFor(notes);
    const disabled = options.disabled ?? false;
    const mode = options.mode ?? "select";
    if (
      snapshot &&
      snapshot.notes === notes &&
      snapshot.selection === selection &&
      snapshot.rows === rows &&
      snapshot.band === band &&
      snapshot.editing === editing &&
      snapshot.disabled === disabled &&
      snapshot.mode === mode &&
      snapshot.bounds.duration === limits.duration &&
      snapshot.bounds.minLength === limits.minLength &&
      snapshot.bounds.minPitch === limits.minPitch &&
      snapshot.bounds.maxPitch === limits.maxPitch &&
      snapshot.active.size === active.size &&
      [...active].every((pitch) => snapshot?.active.has(pitch))
    ) {
      return snapshot;
    }
    snapshot = {
      active,
      band,
      bounds: limits,
      disabled,
      editing,
      folded: rows.folded,
      mode,
      noteById: noteById(notes),
      notes,
      rows,
      selection,
    };
    return snapshot;
  };

  /** Proposes new notes: reports them, and keeps them unless canceled. */
  const change = (next: Note[], details: PianoRollChangeEventDetails) => {
    if (sameNotes(next, displayed())) {
      return false;
    }
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.value === undefined) {
      uncontrolled = next;
    } else if (editing) {
      dragValue = next;
    }
    notify();
    return true;
  };

  const commit = (value: Note[], details: PianoRollCommitEventDetails) => {
    options.onValueCommitted?.(value, details);
  };

  /** Ends the editing, dropping the held notes: the controlled value rules again. */
  const endEditing = () => {
    editing = false;
    dragValue = null;
    notify();
  };

  /** Proposes a selection; returns whether it was applied. */
  const select = (
    ids: readonly NoteId[],
    details: PianoRollSelectionEventDetails
  ) => {
    const current = selectedIds();
    if (ids.length === current.size && ids.every((id) => current.has(id))) {
      return false;
    }
    options.onSelectionChange?.(ids, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.selection === undefined) {
      uncontrolledSelection = ids;
      selectionFor = null;
    }
    notify();
    return true;
  };

  const createId = (): NoteId => {
    if (options.createNoteId) {
      return options.createNoteId();
    }
    const taken = new Set(displayed().map((note) => note.id));
    let id = `note-${nextId}`;
    while (taken.has(id)) {
      nextId += 1;
      id = `note-${nextId}`;
    }
    nextId += 1;
    return id;
  };

  const sound = (pitch: number, details: PianoRollNoteOnEventDetails) => {
    if (options.disabled) {
      return false;
    }
    options.onNoteOn?.(pitch, details);
    if (details.isCanceled) {
      return false;
    }
    lastPitch = pitch;
    sounding = new Set(sounding).add(pitch);
    notify();
    return true;
  };

  const silence = (pitch: number, details: PianoRollNoteOffEventDetails) => {
    const next = new Set(sounding);
    next.delete(pitch);
    sounding = next;
    notify();
    options.onNoteOff?.(pitch, details);
  };

  /** The velocity a note drawn or played gets, when the roll has none to give it. */
  const template = () => {
    const length = bounds().minLength;
    return drawTemplate ?? { length, velocity: 1 };
  };

  const remember = (id: NoteId) => {
    const latest = displayed().find((note) => note.id === id);
    drawTemplate = {
      length: drawTemplate?.length ?? bounds().minLength,
      velocity: latest?.velocity ?? 1,
    };
  };

  /** Applies an edit from the keyboard and commits it at once; returns whether it was applied. */
  const applyKeyboard = (
    next: Note[],
    edit: PianoRollEdit,
    event: KeyboardEvent
  ) => {
    const details = Object.assign(createChangeEventDetails("keyboard", event), {
      edit,
    }) as PianoRollChangeEventDetails;
    if (!change(next, details)) {
      return false;
    }
    commit(next, {
      edit,
      event,
      reason: "keyboard",
    } as PianoRollCommitEventDetails);
    return true;
  };

  /** Adds a note at `start` on `pitch`, of the length and velocity last drawn; returns it with the notes it made, or null. */
  const addNote = (
    start: number,
    pitch: number,
    reason: "double-click" | "draw" | "keyboard",
    event: Event
  ): { note: Note; notes: Note[] } | null => {
    const { length, velocity } = template();
    const note = sanitizeNote(
      { id: createId(), length, pitch, start, velocity },
      bounds()
    );
    const details = Object.assign(createChangeEventDetails(reason, event), {
      edit: "add" as const,
    }) as PianoRollChangeEventDetails;
    const notes = [...displayed(), note];
    if (!change(notes, details)) {
      return null;
    }
    select(
      [note.id],
      createChangeEventDetails(reason, event) as PianoRollSelectionEventDetails
    );
    return { note, notes };
  };

  /** The timeline's units per px of the grid, which a drag converts with. */
  const unitsPerPixel = (grid: Element): number => {
    const { duration, zoom } = options.timeline;
    if (zoom !== null) {
      return 1 / zoom;
    }
    const { width } = grid.getBoundingClientRect();
    return duration / Math.max(width, 1);
  };

  /** Where a note drawn under the pointer starts: the grid cell it is in. */
  const startAt = (
    grid: Element,
    event: { clientX: number; ctrlKey?: boolean; metaKey?: boolean }
  ) => {
    const { duration, grid: cells, zoom } = options.timeline;
    const raw = timeAt(grid, event.clientX, zoom, duration);
    return bypassesGrid(event) ? raw : cellStart(raw, cells);
  };

  /** The pitch of the row under `clientY`. */
  const pitchAt = (grid: Element, clientY: number): number => {
    const rows = rowsFor(displayed());
    const count = rows.pitches.length;
    const rect = grid.getBoundingClientRect();
    const row = clamp(
      Math.floor(((clientY - rect.top) / rect.height) * count),
      0,
      count - 1
    );
    return rows.pitchAt(row);
  };

  /** The notes a key press or a drag acts on: the selection, when the note is part of it. */
  const targetsOf = (id: NoteId): ReadonlySet<NoteId> =>
    selectedIds().has(id) ? selectedIds() : new Set([id]);

  const removeNotes = (
    anchor: NoteId,
    ids: ReadonlySet<NoteId>,
    reason: "double-click" | "keyboard",
    event: KeyboardEvent | MouseEvent
  ) => {
    const base = displayed();
    const order = spatialOrder(base);
    const index = order.findIndex((other) => other.id === anchor);
    const kept = (other: Note) => !ids.has(other.id);
    const neighbour =
      order.slice(index + 1).find(kept) ?? order.slice(0, index).findLast(kept);
    const next = base.filter(kept);
    const details = Object.assign(createChangeEventDetails(reason, event), {
      edit: "remove" as const,
    }) as PianoRollChangeEventDetails;
    if (!change(next, details)) {
      return;
    }
    commit(next, {
      edit: "remove",
      event,
      reason,
    } as PianoRollCommitEventDetails);
    select(
      [...selectedIds()].filter((id) => !ids.has(id)),
      createChangeEventDetails(reason, event) as PianoRollSelectionEventDetails
    );
    if (reason === "keyboard") {
      options.requestFocus?.(neighbour?.id ?? null);
    }
  };

  /** Adds `id` to the selection, or takes it out. */
  const toggleSelected = (
    id: NoteId,
    event: PointerEvent | KeyboardEvent,
    reason: "press" | "keyboard"
  ) => {
    const selection = selectedIds();
    const next = selection.has(id)
      ? [...selection].filter((other) => other !== id)
      : [...selection, id];
    select(
      next,
      createChangeEventDetails(reason, event) as PianoRollSelectionEventDetails
    );
  };

  /** Sounds `pitch` in place of what the gesture was sounding. */
  const audition = (
    current: NoteGesture,
    pitch: number,
    event: PointerEvent,
    velocity: number
  ) => {
    if (current.sounding === pitch) {
      return;
    }
    if (current.sounding !== null) {
      silence(current.sounding, { event, reason: "drag" });
    }
    const details = Object.assign(createChangeEventDetails("drag", event), {
      velocity,
    }) as PianoRollNoteOnEventDetails;
    current.sounding = sound(pitch, details) ? pitch : null;
  };

  /** Swaps the notes being dragged for copies left on top of them. */
  const copyNotes = (current: NoteGesture, event: PointerEvent) => {
    const { copyOf, notes } = duplicateNotes(
      current.origin,
      current.ids,
      createId
    );
    const details = Object.assign(createChangeEventDetails("drag", event), {
      edit: "duplicate" as const,
    }) as PianoRollChangeEventDetails;
    if (!change(notes, details)) {
      return;
    }
    current.origin = notes;
    current.ids = new Set(copyOf.values());
    current.anchor = {
      ...current.anchor,
      id: copyOf.get(current.anchor.id) ?? current.anchor.id,
    };
    current.edit = "duplicate";
    select(
      [...current.ids],
      createChangeEventDetails("drag", event) as PianoRollSelectionEventDetails
    );
  };

  /** Moves a note's velocity by `delta`, and that of the selection with it when the note is part of it. */
  const nudgeVelocity = (
    id: NoteId,
    delta: number,
    reason: "input-change" | "keyboard",
    event: Event
  ) => {
    const next = changeVelocity(displayed(), targetsOf(id), delta);
    const details = Object.assign(createChangeEventDetails(reason, event), {
      edit: "velocity" as const,
    }) as PianoRollChangeEventDetails;
    if (!change(next, details)) {
      return;
    }
    commit(next, {
      edit: "velocity",
      event,
      reason,
    } as PianoRollCommitEventDetails);
    remember(id);
  };

  // ---- grid

  const moveGrid = (event: PointerEvent) => {
    const current = gridGesture;
    if (!current) {
      return;
    }
    if (current.kind === "marquee") {
      moveMarquee(current, event);
      return;
    }
    moveDraw(current, event);
  };

  const moveMarquee = (
    current: Extract<GridGesture, { kind: "marquee" }>,
    event: PointerEvent
  ) => {
    const rect = current.grid.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    band = {
      height: Math.abs(y - current.y),
      left: Math.min(x, current.x),
      top: Math.min(y, current.y),
      width: Math.abs(x - current.x),
    };
    const perPixel = unitsPerPixel(current.grid);
    const rowHeight = rect.height / rowsFor(displayed()).pitches.length;
    const within = notesWithin(
      displayed(),
      {
        end: (band.left + band.width) * perPixel,
        firstRow: Math.floor(band.top / rowHeight),
        lastRow: Math.ceil((band.top + band.height) / rowHeight) - 1,
        start: band.left * perPixel,
      },
      rowsFor(displayed()).rowOf
    );
    select(
      [...new Set([...current.base, ...within])],
      createChangeEventDetails(
        "marquee",
        event
      ) as PianoRollSelectionEventDetails
    );
    notify();
  };

  const moveDraw = (
    current: Extract<GridGesture, { kind: "draw" }>,
    event: PointerEvent
  ) => {
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.started && dx * dx + dy * dy < DRAG_THRESHOLD ** 2) {
      return;
    }
    current.started = true;
    const { duration, grid, zoom } = options.timeline;
    const raw = timeAt(current.grid, event.clientX, zoom, duration);
    const end = bypassesGrid(event) ? raw : snapToGrid(raw, grid);
    const length = Math.min(
      duration - current.start,
      Math.max(bounds().minLength, end - current.start)
    );
    const next = displayed().map((note) =>
      note.id === current.id ? { ...note, length } : note
    );
    change(
      next,
      Object.assign(createChangeEventDetails("draw", event), {
        edit: "add" as const,
      }) as PianoRollChangeEventDetails
    );
  };

  const endGrid = (event: PointerEvent) => {
    const current = gridGesture;
    gridGesture = null;
    if (!current) {
      return;
    }
    if (current.kind === "marquee") {
      band = null;
      notify();
      return;
    }
    // Read before settling: the notes fall back to the known value after.
    const committed = [...displayed()];
    endEditing();
    const drawn = committed.find((note) => note.id === current.id);
    if (drawn) {
      drawTemplate = {
        length: drawn.length,
        velocity: drawTemplate?.velocity ?? 1,
      };
    }
    commit(committed, { edit: "add", event, reason: "draw" });
    if (current.sounding !== null) {
      silence(current.sounding, { event, reason: "draw" });
    }
  };

  const pressGrid: PianoRollController["pressGrid"] = (event, grid) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    if ((options.mode ?? "select") === "select") {
      if (!event.shiftKey) {
        select([], createChangeEventDetails("marquee", event));
      }
      grid.setPointerCapture?.(event.pointerId);
      const rect = grid.getBoundingClientRect();
      gridGesture = {
        base: event.shiftKey ? [...selectedIds()] : [],
        grid,
        kind: "marquee",
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      followPointer(grid, event.pointerId, moveGrid, endGrid);
      return;
    }
    editing = true;
    notify();
    const added = addNote(
      startAt(grid, event),
      pitchAt(grid, event.clientY),
      "draw",
      event
    );
    if (!added) {
      endEditing();
      return;
    }
    grid.setPointerCapture?.(event.pointerId);
    const soundingPitch = sound(
      added.note.pitch,
      Object.assign(createChangeEventDetails("draw", event), {
        velocity: added.note.velocity ?? 1,
      }) as PianoRollNoteOnEventDetails
    )
      ? added.note.pitch
      : null;
    gridGesture = {
      grid,
      id: added.note.id,
      kind: "draw",
      sounding: soundingPitch,
      start: added.note.start,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    followPointer(grid, event.pointerId, moveGrid, endGrid);
  };

  const doubleClickGrid: PianoRollController["doubleClickGrid"] = (
    event,
    grid
  ) => {
    if (options.disabled || (options.mode ?? "select") !== "select") {
      return;
    }
    const added = addNote(
      startAt(grid, event),
      pitchAt(grid, event.clientY),
      "double-click",
      event
    );
    if (added) {
      commit(added.notes, { edit: "add", event, reason: "double-click" });
    }
  };

  const keyGrid: PianoRollController["keyGrid"] = (event) => {
    if (options.disabled) {
      return false;
    }
    if (shortcut(event)) {
      return true;
    }
    if (event.key === "Escape") {
      select([], createChangeEventDetails("keyboard", event));
      return true;
    }
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      select(
        displayed().map((note) => note.id),
        createChangeEventDetails("keyboard", event)
      );
      return true;
    }
    return false;
  };

  const addAtPlayback: PianoRollController["addAtPlayback"] = (event) => {
    if (options.disabled) {
      return false;
    }
    const { pitches } = rowsFor(displayed());
    const pitch =
      lastPitch ?? pitches[Math.floor(pitches.length / 2)] ?? bounds().minPitch;
    const added = addNote(
      cellStart(options.timeline.position(), options.timeline.grid),
      pitch,
      "keyboard",
      event
    );
    if (!added) {
      return false;
    }
    commit(added.notes, { edit: "add", event, reason: "keyboard" });
    options.requestFocus?.(added.note.id);
    return true;
  };

  // ---- notes

  const moveNote = (event: PointerEvent) => {
    const current = noteGesture;
    if (!current) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.started) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD ** 2) {
        return;
      }
      current.started = true;
      if (current.copy) {
        copyNotes(current, event);
      }
    }
    const next = draggedNotes(
      current,
      dx * unitsPerPixel(current.grid),
      dy,
      bypassesGrid(event) ? NO_GRID : options.timeline.grid,
      bounds()
    );
    const details = Object.assign(createChangeEventDetails("drag", event), {
      edit: current.edit,
    }) as PianoRollChangeEventDetails;
    if (change(next, details)) {
      current.changed = true;
    }
    const moved = displayed().find((other) => other.id === current.anchor.id);
    if (moved) {
      audition(current, moved.pitch, event, current.anchor.velocity ?? 1);
    }
  };

  const endNote = (event: PointerEvent) => {
    const current = noteGesture;
    if (!current) {
      return;
    }
    noteGesture = null;
    // Read before settling: the notes fall back to the known value after.
    const committed = [...displayed()];
    endEditing();
    if (current.changed) {
      if (current.handle !== "move") {
        const resized = committed.find(
          (other) => other.id === current.anchor.id
        );
        if (resized) {
          drawTemplate = {
            length: resized.length,
            velocity: drawTemplate?.velocity ?? 1,
          };
        }
      }
      commit(committed, { edit: current.edit, event, reason: "drag" });
      if (current.edit === "duplicate") {
        // The copy is what was dragged: the keys should act on it next.
        options.requestFocus?.(current.anchor.id);
      }
    }
    if (current.sounding !== null) {
      silence(current.sounding, { event, reason: "drag" });
    }
  };

  const pressNote: PianoRollController["pressNote"] = (
    id,
    handle,
    event,
    element,
    grid
  ) => {
    if (options.disabled) {
      return;
    }
    const selection = selectedIds();
    if (handle === "move" && event.shiftKey) {
      toggleSelected(id, event, "press");
      return;
    }
    let ids = selection;
    if (!selection.has(id)) {
      ids = new Set([id]);
      select([id], createChangeEventDetails("press", event));
    }
    const anchor = displayed().find((note) => note.id === id);
    if (!anchor) {
      return;
    }
    const rect = grid.getBoundingClientRect();
    element.setPointerCapture?.(event.pointerId);
    editing = true;
    notify();
    const rows = rowsFor(displayed());
    noteGesture = {
      anchor,
      changed: false,
      copy: handle === "move" && event.altKey,
      edit: handle === "move" ? "move" : "resize",
      grid,
      handle,
      ids,
      origin: [...displayed()],
      rowHeight: rect.height / rows.pitches.length,
      rows,
      sounding: null,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    audition(noteGesture, anchor.pitch, event, anchor.velocity ?? 1);
    followPointer(element, event.pointerId, moveNote, endNote);
  };

  const doubleClickNote: PianoRollController["doubleClickNote"] = (
    id,
    event
  ) => {
    if (!options.disabled) {
      removeNotes(id, new Set([id]), "double-click", event);
    }
  };

  const keyNote: PianoRollController["keyNote"] = (id, event) => {
    if (options.disabled) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      removeNotes(id, targetsOf(id), "keyboard", event);
      return true;
    }
    if (event.key === "Enter" || event.key === " ") {
      toggleSelected(id, event, "keyboard");
      return true;
    }
    const result = keyboardEdit(
      displayed(),
      targetsOf(id),
      event.key,
      event.shiftKey,
      options.timeline.step,
      bounds()
    );
    if (!result) {
      return false;
    }
    const before = displayed().find((note) => note.id === id)?.pitch;
    if (applyKeyboard(result.notes, result.edit, event)) {
      // Notes render in the order they are read, so a move can reorder them
      // and take the focus with it.
      options.requestFocus?.(id);
    }
    const after = displayed().find((note) => note.id === id);
    if (after && after.pitch !== before) {
      releaseKey(event);
      keySounding = sound(
        after.pitch,
        Object.assign(createChangeEventDetails("keyboard", event), {
          velocity: after.velocity ?? 1,
        }) as PianoRollNoteOnEventDetails
      )
        ? after.pitch
        : null;
    }
    return true;
  };

  const releaseKey: PianoRollController["releaseKey"] = (event) => {
    if (keySounding === null) {
      return;
    }
    silence(keySounding, {
      event: event as FocusEvent | KeyboardEvent,
      reason: "keyboard",
    } as PianoRollNoteOffEventDetails);
    keySounding = null;
  };

  // ---- velocity

  const moveVelocity = (event: PointerEvent) => {
    const current = velocityGesture;
    if (!current?.height) {
      return;
    }
    // Up is louder: the bar follows the pointer.
    const delta = (current.startY - event.clientY) / current.height;
    const next = changeVelocity(current.origin, current.ids, delta);
    const details = Object.assign(createChangeEventDetails("drag", event), {
      edit: "velocity" as const,
    }) as PianoRollChangeEventDetails;
    if (change(next, details)) {
      current.changed = true;
    }
  };

  const endVelocity = (event: PointerEvent) => {
    const current = velocityGesture;
    if (!current) {
      return;
    }
    velocityGesture = null;
    // Read before settling: the notes fall back to the known value after.
    const committed = [...displayed()];
    endEditing();
    if (current.changed) {
      commit(committed, { edit: "velocity", event, reason: "drag" });
      remember(current.id);
    }
  };

  const pressVelocity: PianoRollController["pressVelocity"] = (
    id,
    event,
    element,
    lane
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    const selection = selectedIds();
    if (event.shiftKey) {
      toggleSelected(id, event, "press");
      return;
    }
    let ids = selection;
    if (!selection.has(id)) {
      ids = new Set([id]);
      select([id], createChangeEventDetails("press", event));
    }
    element.setPointerCapture?.(event.pointerId);
    editing = true;
    notify();
    velocityGesture = {
      changed: false,
      height: lane?.getBoundingClientRect().height ?? 0,
      id,
      ids,
      origin: [...displayed()],
      startY: event.clientY,
    };
    followPointer(element, event.pointerId, moveVelocity, endVelocity);
  };

  const keyVelocity: PianoRollController["keyVelocity"] = (id, event) => {
    if (options.disabled) {
      return false;
    }
    const velocity = displayed().find((note) => note.id === id)?.velocity ?? 1;
    const target = {
      ArrowDown: velocity - VELOCITY_STEP,
      ArrowLeft: velocity - VELOCITY_STEP,
      ArrowRight: velocity + VELOCITY_STEP,
      ArrowUp: velocity + VELOCITY_STEP,
      End: 1,
      Home: 0,
      PageDown: velocity - VELOCITY_LARGE_STEP,
      PageUp: velocity + VELOCITY_LARGE_STEP,
    }[event.key];
    if (target === undefined) {
      return false;
    }
    nudgeVelocity(id, target - velocity, "keyboard", event);
    return true;
  };

  const setVelocity: PianoRollController["setVelocity"] = (
    id,
    value,
    event
  ) => {
    const velocity = displayed().find((note) => note.id === id)?.velocity ?? 1;
    nudgeVelocity(id, value - velocity, "input-change", event);
  };

  // ---- keys and commands

  const shortcut: PianoRollController["shortcut"] = (event) => {
    if (event.altKey) {
      return false;
    }
    const key = event.key.toLowerCase();
    const cells = options.timeline.grid;
    const copy = (cut: boolean) => {
      const chosen = selectedIds();
      if (chosen.size === 0) {
        return;
      }
      const current = displayed();
      clipboard = current.filter((note) => chosen.has(note.id));
      if (cut) {
        applyKeyboard(
          current.filter((note) => !chosen.has(note.id)),
          "remove",
          event
        );
        select([], createChangeEventDetails("keyboard", event));
      }
    };
    const duplicate = () => {
      const result = duplicateAfter(
        displayed(),
        selectedIds(),
        createId,
        bounds()
      );
      if (result && applyKeyboard(result.notes, "duplicate", event)) {
        select(result.copies, createChangeEventDetails("keyboard", event));
      }
    };
    const paste = () => {
      const result = pasteNotes(
        displayed(),
        clipboard,
        cellStart(options.timeline.position(), cells),
        createId,
        bounds()
      );
      if (result && applyKeyboard(result.notes, "paste", event)) {
        select(result.pasted, createChangeEventDetails("keyboard", event));
      }
    };
    // As in a DAW: with nothing selected, everything is quantized.
    const quantize = () => {
      const current = displayed();
      const chosen = selectedIds();
      const ids =
        chosen.size > 0 ? chosen : new Set(current.map((note) => note.id));
      applyKeyboard(
        quantizeNotes(
          current,
          ids,
          (start) => snapToGrid(start, cells),
          bounds()
        ),
        "quantize",
        event
      );
    };
    const commands: Record<string, (() => void) | undefined> =
      event.metaKey || event.ctrlKey
        ? {
            c: () => copy(false),
            d: duplicate,
            v: paste,
            x: () => copy(true),
          }
        : { q: quantize };
    const run = commands[key];
    run?.();
    return run !== undefined;
  };

  const keyOn: PianoRollController["keyOn"] = (pitch, details) => {
    if (!details.event.shiftKey) {
      sound(
        pitch,
        Object.assign(details, { velocity: 1 }) as PianoRollNoteOnEventDetails
      );
      return;
    }
    details.cancel();
    if (details.reason === "glide") {
      return;
    }
    // Takes every note on the row, or gives them all back.
    const row = displayed()
      .filter((note) => note.pitch === pitch)
      .map((note) => note.id);
    if (row.length === 0) {
      return;
    }
    const selection = selectedIds();
    const all = row.every((id) => selection.has(id));
    select(
      all
        ? [...selection].filter((id) => !row.includes(id))
        : [...new Set([...selection, ...row])],
      createChangeEventDetails(
        details.reason,
        details.event
      ) as PianoRollSelectionEventDetails
    );
  };

  const keyOff: PianoRollController["keyOff"] = (pitch, details) => {
    silence(pitch, details);
  };

  return {
    addAtPlayback,
    doubleClickGrid,
    doubleClickNote,
    getSnapshot,
    keyGrid,
    keyNote,
    keyOff,
    keyOn,
    keyVelocity,
    pressGrid,
    pressNote,
    pressVelocity,
    releaseKey,
    setOptions: (next) => {
      options = next;
    },
    setVelocity,
    shortcut,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
