import { followPointer } from "../../dom/gesture.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import {
  type CellAddress,
  cellAtPoint,
  isOn,
  moveFocus,
  type Pattern,
  setCell,
  setVelocity,
  type Velocities,
  velocityAt,
  velocityAtY,
} from "./grid.ts";

const EMPTY_PATTERN: readonly (readonly boolean[])[] = [];
const EMPTY_VELOCITIES: readonly (readonly number[])[] = [];

export type SequencerValueChangeEventDetails =
  | ChangeEventDetails<"press" | "paint", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>;
export type SequencerValueCommitEventDetails =
  | CommitEventDetails<"press" | "paint", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>;

export type SequencerVelocityChangeEventDetails =
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change" | "reset", Event>;
export type SequencerVelocityCommitEventDetails =
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change" | "reset", Event>;

export interface SequencerOptions {
  /** Uncontrolled starting pattern: a row per sound, each a list of steps. */
  defaultValue?: Pattern;
  /** Uncontrolled starting velocities. */
  defaultVelocities?: Velocities;
  disabled?: boolean;
  onValueChange?: (
    value: boolean[][],
    details: SequencerValueChangeEventDetails
  ) => void;
  onValueCommitted?: (
    value: boolean[][],
    details: SequencerValueCommitEventDetails
  ) => void;
  onVelocityChange?: (
    velocities: number[][],
    details: SequencerVelocityChangeEventDetails
  ) => void;
  onVelocityCommitted?: (
    velocities: number[][],
    details: SequencerVelocityCommitEventDetails
  ) => void;
  /** The pattern: a row per sound, each a list of steps. */
  value?: Pattern;
  /** How loud each step plays, 0…1, a row per sound like the pattern. */
  velocities?: Velocities;
}

/** What a view draws the sequencer from. */
export interface SequencerSnapshot {
  disabled: boolean;
  /** Whether a pointer is painting cells. */
  painting: boolean;
  rows: number;
  steps: number;
  /** The cell the arrow keys start from: the one tab stop among the cells. */
  tabStop: CellAddress;
  value: Pattern;
  velocities: Velocities;
}

/** Which element a pointer gesture reads its cells from: a map of the cell elements by key. */
export type SequencerCellNodes = ReadonlyMap<string, Element>;

export interface SequencerController {
  getSnapshot: () => SequencerSnapshot;
  /** Where an arrow, Home or End key takes the focus from `from`: the new tab stop, or null when the key is not the grid's. */
  moveFocusFrom: (
    from: CellAddress,
    event: KeyboardEvent
  ) => CellAddress | null;
  /**
   * Starts a press on a cell: a drag paints the cells the pointer crosses with
   * the state of the first, and `nodes` are the cells it can cross.
   */
  pressCell: (
    cell: CellAddress,
    event: PointerEvent,
    root: Element,
    nodes: SequencerCellNodes
  ) => void;
  /**
   * Starts a press on a step's velocity bar: a drag draws the velocities of
   * the steps the pointer crosses in that row, from the bar's nodes.
   */
  pressVelocity: (
    cell: CellAddress,
    event: PointerEvent,
    root: Element,
    nodes: SequencerCellNodes
  ) => void;
  setOptions: (options: SequencerOptions) => void;
  /** Moves the tab stop, without focusing anything. */
  setTabStop: (cell: CellAddress) => void;
  /** Sets one step's velocity and commits it at once: a key, an input or a reset. */
  setVelocity: (
    cell: CellAddress,
    velocity: number,
    reason: "keyboard" | "input-change" | "reset",
    event: Event
  ) => void;
  subscribe: (listener: () => void) => () => void;
  /** Handles a key on a cell: Space or Enter flips it (the caller prevents the default). */
  toggleCell: (cell: CellAddress, event: KeyboardEvent) => void;
}

/** One paint gesture on the cells: the state each crossed cell is set to. */
interface PaintGesture {
  changed: boolean;
  nodes: SequencerCellNodes;
  /** The opposite of the state of the cell the gesture began on. */
  on: boolean;
}

/** One draw gesture on the velocity bars, in the row it began in. */
interface VelocityGesture {
  changed: boolean;
  nodes: SequencerCellNodes;
  row: number;
}

/**
 * A sequencer's behavior with no view attached: its pattern and velocities,
 * held or controlled, its tab stop, and every way of painting them.
 */
export function createSequencerController(
  initial: SequencerOptions = {}
): SequencerController {
  let options = initial;

  // The pattern and velocities as the gesture under way left them: a
  // controlled value that lags behind must not pull them back mid-gesture.
  // Reset on every render, as the props take over again.
  let pattern: Pattern | null = null;
  let velocitiesNow: Velocities | null = null;
  let uncontrolledValue: Pattern | undefined;
  let uncontrolledVelocities: Velocities | undefined;
  let painting = false;
  let paint: PaintGesture | null = null;
  let drawing: VelocityGesture | null = null;
  let tabStop: CellAddress = { row: 0, step: 0 };
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  /** The pattern and velocities the props or the roll hold: what a view shows. */
  const heldPattern = (): Pattern =>
    options.value ?? uncontrolledValue ?? options.defaultValue ?? EMPTY_PATTERN;
  const heldVelocities = (): Velocities =>
    options.velocities ??
    uncontrolledVelocities ??
    options.defaultVelocities ??
    EMPTY_VELOCITIES;
  /** The pattern and velocities as the gesture under way left them. */
  const currentPattern = (): Pattern => pattern ?? heldPattern();
  const currentVelocities = (): Velocities => velocitiesNow ?? heldVelocities();

  let snapshot: SequencerSnapshot | null = null;
  const getSnapshot = (): SequencerSnapshot => {
    const value = heldPattern();
    const velocities = heldVelocities();
    const rows = value.length;
    const steps = value[0]?.length ?? 0;
    const disabled = options.disabled ?? false;
    // The tab stop is kept inside the grid, whatever its size now.
    const stop = {
      row: Math.min(tabStop.row, Math.max(0, rows - 1)),
      step: Math.min(tabStop.step, Math.max(0, steps - 1)),
    };
    if (
      snapshot &&
      snapshot.value === value &&
      snapshot.velocities === velocities &&
      snapshot.painting === painting &&
      snapshot.disabled === disabled &&
      snapshot.rows === rows &&
      snapshot.steps === steps &&
      snapshot.tabStop.row === stop.row &&
      snapshot.tabStop.step === stop.step
    ) {
      return snapshot;
    }
    snapshot = {
      disabled,
      painting,
      rows,
      steps,
      tabStop: stop,
      value,
      velocities,
    };
    return snapshot;
  };

  /** Proposes a pattern; keeps it unless canceled. Returns the pattern applied, or null. */
  const changePattern = (
    next: Pattern,
    details: SequencerValueChangeEventDetails
  ): Pattern | null => {
    options.onValueChange?.(next as boolean[][], details);
    if (details.isCanceled) {
      return null;
    }
    pattern = next;
    if (options.value === undefined) {
      uncontrolledValue = next;
    }
    notify();
    return next;
  };

  /** Sets one cell, if it differs; returns the pattern applied, or null. */
  const setCellTo = (
    cell: CellAddress,
    on: boolean,
    details: SequencerValueChangeEventDetails
  ): Pattern | null => {
    const current = currentPattern();
    if (isOn(current, cell) === on) {
      return null;
    }
    return changePattern(setCell(current, cell, on), details);
  };

  /** Proposes a velocity for one step; returns the velocities applied, or null. */
  const changeVelocity = (
    cell: CellAddress,
    velocity: number,
    details: SequencerVelocityChangeEventDetails
  ): Velocities | null => {
    const current = currentVelocities();
    const rows = currentPattern().length;
    const steps = currentPattern()[0]?.length ?? 0;
    const clamped = Math.min(1, Math.max(0, velocity));
    const next = setVelocity(current, cell, clamped, rows, steps);
    if (next[cell.row]?.[cell.step] === velocityAt(current, cell)) {
      return null;
    }
    options.onVelocityChange?.(next, details);
    if (details.isCanceled) {
      return null;
    }
    velocitiesNow = next;
    if (options.velocities === undefined) {
      uncontrolledVelocities = next;
    }
    notify();
    return next;
  };

  /** Sets the velocity of the step under the pointer, in the row being drawn. */
  const drawVelocityAt = (
    event: PointerEvent,
    row: number,
    nodes: SequencerCellNodes
  ) => {
    for (const [key, node] of nodes) {
      const [nodeRow, nodeStep] = key.split(":").map(Number);
      if (nodeRow !== row) {
        continue;
      }
      const box = node.getBoundingClientRect();
      if (event.clientX >= box.left && event.clientX < box.right) {
        const cell = { row, step: nodeStep ?? 0 };
        const applied = changeVelocity(
          cell,
          velocityAtY(box, event.clientY),
          createChangeEventDetails("drag", event)
        );
        if (applied && drawing) {
          drawing.changed = true;
        }
        return;
      }
    }
  };

  const toggleCell: SequencerController["toggleCell"] = (cell, event) => {
    if (
      setCellTo(
        cell,
        !isOn(currentPattern(), cell),
        createChangeEventDetails("keyboard", event)
      )
    ) {
      options.onValueCommitted?.(currentPattern() as boolean[][], {
        event,
        reason: "keyboard",
      });
    }
  };

  const moveFocusFrom: SequencerController["moveFocusFrom"] = (from, event) => {
    const value = currentPattern();
    const next = moveFocus(
      from,
      event.key,
      value.length,
      value[0]?.length ?? 0,
      event.ctrlKey || event.metaKey
    );
    if (next) {
      tabStop = next;
      notify();
    }
    return next;
  };

  const pressCell: SequencerController["pressCell"] = (
    cell,
    event,
    root,
    nodes
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    const on = !isOn(currentPattern(), cell);
    const gesture: PaintGesture = { changed: false, nodes, on };
    paint = gesture;
    painting = true;
    notify();
    if (
      setCellTo(cell, on, createChangeEventDetails("press", event)) !== null
    ) {
      gesture.changed = true;
    }
    followPointer(
      root,
      event.pointerId,
      (move) => {
        if (!paint) {
          return;
        }
        const boxes = [...nodes].map(
          ([key, node]) => [key, node.getBoundingClientRect()] as const
        );
        const crossed = cellAtPoint(boxes, move.clientX, move.clientY);
        if (
          crossed &&
          setCellTo(crossed, on, createChangeEventDetails("paint", move)) !==
            null
        ) {
          gesture.changed = true;
        }
      },
      (end) => {
        const current = paint;
        paint = null;
        painting = false;
        notify();
        if (current?.changed) {
          options.onValueCommitted?.(currentPattern() as boolean[][], {
            event: end,
            reason: "paint",
          });
        }
      }
    );
  };

  const pressVelocity: SequencerController["pressVelocity"] = (
    cell,
    event,
    root,
    nodes
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    const gesture: VelocityGesture = { changed: false, nodes, row: cell.row };
    drawing = gesture;
    drawVelocityAt(event, cell.row, nodes);
    followPointer(
      root,
      event.pointerId,
      (move) => {
        if (drawing) {
          drawVelocityAt(move, gesture.row, nodes);
        }
      },
      (end) => {
        const current = drawing;
        drawing = null;
        if (current?.changed) {
          options.onVelocityCommitted?.(currentVelocities() as number[][], {
            event: end,
            reason: "drag",
          });
        }
      }
    );
  };

  const setVelocityAt: SequencerController["setVelocity"] = (
    cell,
    velocity,
    reason,
    event
  ) => {
    const details = createChangeEventDetails(
      reason,
      event
    ) as SequencerVelocityChangeEventDetails;
    if (changeVelocity(cell, velocity, details)) {
      options.onVelocityCommitted?.(
        currentVelocities() as number[][],
        {
          event,
          reason,
        } as SequencerVelocityCommitEventDetails
      );
    }
  };

  return {
    getSnapshot,
    moveFocusFrom,
    pressCell,
    pressVelocity,
    setOptions: (next) => {
      options = next;
      // The props take over again on every render.
      pattern = null;
      velocitiesNow = null;
    },
    setTabStop: (cell) => {
      tabStop = cell;
      notify();
    },
    setVelocity: setVelocityAt,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggleCell,
  };
}
