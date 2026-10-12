import { followPointer } from "../../dom/gesture.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import {
  normalizeRange,
  type RangeEdge,
  type RangeValue,
} from "../../value/range.ts";
import { keyTargets } from "./clip-controller.ts";
import { valueAtLane } from "./position.ts";
import { bypassesGrid, type Grid, snapRangeMove, snapToGrid } from "./snap.ts";

type Edged<Details> = Details & {
  /** What moved: one edge, or the whole range with `"both"`. */
  edge: RangeEdge;
};

export type RangeChangeEventDetails = Edged<
  | ChangeEventDetails<"drag" | "draw", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>
>;
export type RangeCommitEventDetails = Edged<
  | CommitEventDetails<"drag" | "draw", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>
>;

export interface RangeOptions {
  defaultValue?: RangeValue;
  disabled?: boolean;
  /** Whether dragging across empty lane draws a new range. */
  drawable?: boolean;
  duration: number;
  grid: Grid;
  largeStep: number;
  /** The shortest the range can be, in the timeline's units. */
  minLength: number;
  /** Whether dragging the body, or its keys, moves the range. */
  movable: boolean;
  onValueChange?: (value: RangeValue, details: RangeChangeEventDetails) => void;
  onValueCommitted?: (
    value: RangeValue,
    details: RangeCommitEventDetails
  ) => void;
  step: number;
  /** The controlled range. */
  value?: RangeValue;
  /** The timeline's px per unit, or null while it fits its lane. */
  zoom: number | null;
}

/** What a view draws a range from. */
export interface RangeSnapshot {
  disabled: boolean;
  /** Whether a pointer is moving, resizing or drawing the range. */
  dragging: boolean;
  /** The range as displayed: the dragged one while a pointer moves it. */
  value: RangeValue;
}

export interface RangeController {
  /** Keys on a handle's input: arrows and Page keys move the edge, Home and End go to its limits. Returns `true` when the handle takes the key. */
  edgeKeyDown: (edge: "end" | "start", event: KeyboardEvent) => boolean;
  /** How far an edge can go, before it meets the other one. */
  edgeRange: (edge: "end" | "start") => readonly [number, number];
  /** An input moves an edge to a position. */
  edgeTypeAt: (edge: "end" | "start", position: number, event: Event) => void;
  getSnapshot: () => RangeSnapshot;
  /** Keys on the range's own input: arrows and Page keys move it, Home and End go to the ends of the timeline. Returns `true` when the range takes the key. */
  keyDown: (event: KeyboardEvent) => boolean;
  /** An input moves the range to a start, keeping its length. */
  moveTypeAt: (start: number, event: Event) => void;
  /**
   * Starts a drag of `edge` (or the whole range, `"both"`) from `handle`. The
   * drag is measured on the lane the range sits on, `lane`, in px.
   */
  press: (
    edge: RangeEdge,
    event: PointerEvent,
    handle: Element,
    lane: Element | null
  ) => void;
  /**
   * Starts drawing a new range from a press on `lane` itself, where no range is:
   * the drag runs from where the press began to where the pointer is.
   */
  pressDraw: (event: PointerEvent, lane: Element) => void;
  setOptions: (options: RangeOptions) => void;
  subscribe: (listener: () => void) => () => void;
}

/** One drag, from press to release. */
interface RangeGesture {
  changed: boolean;
  /** The range when the pointer went down: the drag is measured from it. */
  origin: RangeValue;
  startX: number;
}

/**
 * A range's behavior with no view attached: its span on the timeline, held or
 * controlled, moved or resized by its body or its edges, drawn across empty
 * lane, and moved by the keys and inputs.
 */
export function createRangeController(initial: RangeOptions): RangeController {
  let options = initial;
  const limits = () => ({
    duration: options.duration,
    minLength: options.minLength,
  });

  let uncontrolled: RangeValue | undefined;
  // The range as the gesture under way left it: a controlled range that lags
  // behind must not pull it back mid-drag.
  let latest: RangeValue | null = null;
  let dragging = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const held = (): RangeValue =>
    normalizeRange(
      options.value ??
        uncontrolled ??
        options.defaultValue ?? [0, options.duration],
      options.duration
    );
  const current = (): RangeValue => latest ?? held();

  let snapshot: RangeSnapshot | null = null;
  const getSnapshot = (): RangeSnapshot => {
    const value = dragging && latest !== null ? latest : held();
    const disabled = options.disabled ?? false;
    if (
      snapshot &&
      snapshot.value[0] === value[0] &&
      snapshot.value[1] === value[1] &&
      snapshot.dragging === dragging &&
      snapshot.disabled === disabled
    ) {
      return snapshot;
    }
    snapshot = { disabled, dragging, value };
    return snapshot;
  };

  /** Proposes a range; keeps it unless canceled. */
  const change = (next: RangeValue, details: RangeChangeEventDetails) => {
    const [start, end] = current();
    if (next[0] === start && next[1] === end) {
      return false;
    }
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    latest = next;
    if (options.value === undefined) {
      uncontrolled = next;
    }
    notify();
    return true;
  };

  const commit = (value: RangeValue, details: RangeCommitEventDetails) => {
    options.onValueCommitted?.(value, details);
  };

  /** The limits of an edge: how far it can go before it meets the other one. */
  const edgeRange = (edge: "end" | "start"): readonly [number, number] => {
    const [start, end] = current();
    if (edge === "start") {
      return [0, Math.max(0, end - options.minLength)];
    }
    return [
      Math.min(options.duration, start + options.minLength),
      options.duration,
    ];
  };

  /** Moves the whole range so it starts at `target`, keeping its length. */
  const moveTo = (
    target: number,
    reason: "input-change" | "keyboard",
    event: Event
  ) => {
    if (options.disabled) {
      return;
    }
    const [start, end] = current();
    const span = end - start;
    const from = Math.min(Math.max(0, target), options.duration - span);
    const details = Object.assign(createChangeEventDetails(reason, event), {
      edge: "both" as const,
    }) as RangeChangeEventDetails;
    if (change([from, from + span], details)) {
      commit(current(), {
        edge: "both",
        event,
        reason,
      } as RangeCommitEventDetails);
    }
  };

  const keyDown: RangeController["keyDown"] = (event) => {
    if (options.disabled) {
      return false;
    }
    const [start, end] = current();
    const target = keyTargets(
      start,
      options.step,
      options.largeStep,
      event.shiftKey,
      [0, options.duration - (end - start)]
    )[event.key];
    if (target === undefined) {
      return false;
    }
    moveTo(target, "keyboard", event);
    return true;
  };

  const setEdge = (
    edge: "end" | "start",
    position: number,
    reason: "input-change" | "keyboard",
    event: Event
  ) => {
    const [min, max] = edgeRange(edge);
    const clamped = Math.min(max, Math.max(min, position));
    const [start, end] = current();
    const next: RangeValue =
      edge === "start" ? [clamped, end] : [start, clamped];
    const details = Object.assign(createChangeEventDetails(reason, event), {
      edge,
    }) as RangeChangeEventDetails;
    if (change(next, details)) {
      commit(current(), { edge, event, reason } as RangeCommitEventDetails);
    }
  };

  const edgeKeyDown: RangeController["edgeKeyDown"] = (edge, event) => {
    if (options.disabled) {
      return false;
    }
    const [start, end] = current();
    const at = edge === "start" ? start : end;
    const target = keyTargets(
      at,
      options.step,
      options.largeStep,
      event.shiftKey,
      edgeRange(edge)
    )[event.key];
    if (target === undefined) {
      return false;
    }
    setEdge(edge, target, "keyboard", event);
    return true;
  };

  const edgeTypeAt: RangeController["edgeTypeAt"] = (edge, position, event) => {
    if (!options.disabled) {
      setEdge(edge, position, "input-change", event);
    }
  };

  /** The grid applies unless Cmd/Ctrl is held: read from the pointer's own keys. */
  const valueAt = (lane: Element, event: PointerEvent) => {
    const raw = valueAtLane(
      lane,
      event.clientX,
      options.zoom,
      options.duration
    );
    return bypassesGrid(event) ? raw : snapToGrid(raw, options.grid);
  };

  const press: RangeController["press"] = (edge, event, handle, lane) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    if (edge === "both" && !options.movable) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const gesture: RangeGesture = {
      changed: false,
      origin: current(),
      startX: event.clientX,
    };
    dragging = true;
    notify();
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        // Pixels become units along the lane, the same way a drag reads them.
        const width = lane?.getBoundingClientRect().width ?? 0;
        const perPixel =
          options.zoom === null
            ? options.duration / Math.max(width, 1)
            : 1 / options.zoom;
        const delta = (move.clientX - gesture.startX) * perPixel;
        const grid: Grid = bypassesGrid(move)
          ? { offset: 0, step: 0 }
          : options.grid;
        const next = snapRangeMove(gesture.origin, edge, delta, limits(), grid);
        const details = Object.assign(createChangeEventDetails("drag", move), {
          edge,
        }) as RangeChangeEventDetails;
        if (change(next, details)) {
          gesture.changed = true;
        }
      },
      (end) => {
        // Read before settling: the range falls back to the known value after.
        const committed = current();
        dragging = false;
        latest = null;
        notify();
        if (gesture.changed) {
          commit(committed, {
            edge,
            event: end,
            reason: "drag",
          } as RangeCommitEventDetails);
        }
      }
    );
  };

  const pressDraw: RangeController["pressDraw"] = (event, lane) => {
    if (
      options.disabled ||
      !options.drawable ||
      event.button !== 0 ||
      event.target !== lane
    ) {
      return;
    }
    lane.setPointerCapture?.(event.pointerId);
    const anchor = valueAt(lane, event);
    const drawTo = (pointer: PointerEvent, at: number) => {
      const from = Math.min(anchor, at);
      const to = Math.max(from + options.minLength, Math.max(anchor, at));
      const next = normalizeRange(
        [Math.min(from, options.duration - options.minLength), to],
        options.duration
      );
      return change(
        next,
        Object.assign(createChangeEventDetails("draw", pointer), {
          edge: "both" as const,
        }) as RangeChangeEventDetails
      );
    };
    dragging = true;
    notify();
    const gesture = { changed: drawTo(event, anchor) };
    followPointer(
      lane,
      event.pointerId,
      (move) => {
        if (drawTo(move, valueAt(lane, move))) {
          gesture.changed = true;
        }
      },
      (end) => {
        const committed = current();
        dragging = false;
        latest = null;
        notify();
        if (gesture.changed) {
          commit(committed, {
            edge: "both",
            event: end,
            reason: "draw",
          } as RangeCommitEventDetails);
        }
      }
    );
  };

  return {
    edgeKeyDown,
    edgeRange,
    edgeTypeAt,
    getSnapshot,
    keyDown,
    moveTypeAt: (start, event) => moveTo(start, "input-change", event),
    press,
    pressDraw,
    setOptions: (next) => {
      options = next;
      // The props take over again on every render, unless a gesture is under way.
      if (!dragging) {
        latest = null;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
