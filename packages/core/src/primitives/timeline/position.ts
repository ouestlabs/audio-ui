import { followPointer } from "../../dom/gesture.ts";
import { clampFinite } from "../../shared/math.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import type { Source } from "../../value/source.ts";
import { clampZoom } from "./scale.ts";
import { bypassesGrid, type Grid, snapToGrid } from "./snap.ts";

export type TimelinePositionChangeEventDetails =
  | ChangeEventDetails<"press" | "drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>;
export type TimelinePositionCommitEventDetails =
  | CommitEventDetails<"press" | "drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>;

export type TimelineZoomChangeEventDetails =
  | ChangeEventDetails<"wheel", WheelEvent>
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>
  | ChangeEventDetails<"double-click", MouseEvent>;

export interface TimelineOptions {
  /** Uncontrolled starting position. @default 0 */
  defaultPosition?: number;
  /** Uncontrolled starting zoom, in px per unit. `null` fits the width. */
  defaultZoom?: number | null;
  disabled?: boolean;
  duration: number;
  grid: Grid;
  largeStep: number;
  maxZoom: number;
  minZoom: number;
  onPositionChange?: (
    value: number,
    details: TimelinePositionChangeEventDetails
  ) => void;
  onPositionCommitted?: (
    value: number,
    details: TimelinePositionCommitEventDetails
  ) => void;
  onZoomChange?: (
    zoom: number,
    details: TimelineZoomChangeEventDetails
  ) => void;
  /** The controlled position. */
  position?: number;
  /** A live position, followed without a render: it takes precedence over `position`. */
  source?: Source<number>;
  step: number;
  /** The controlled zoom, in px per unit; `null` fits the width. */
  zoom?: number | null;
}

/** What a view draws the timeline from. */
export interface TimelineSnapshot {
  disabled: boolean;
  duration: number;
  /** Whether no zoom is set, so the timeline fits the width it is given. */
  fitted: boolean;
  /** The position as displayed: the scrubbed one while a pointer moves it. */
  position: number;
  /** Whether a pointer is moving the position. */
  scrubbing: boolean;
  /** px per unit, or null while fitted. */
  zoom: number | null;
}

/** A stretch selected by dragging on the ruler with Shift held. */
export type TimelineSelectionChangeEventDetails = ChangeEventDetails<
  "drag",
  PointerEvent
>;
export type TimelineSelectionCommitEventDetails = CommitEventDetails<
  "drag",
  PointerEvent
>;

/** Listens to the stretch a Shift + drag on the ruler selects: set by the ruler. */
export interface TimelineSelectionHandlers {
  onSelectionChange?: (
    range: readonly [number, number],
    details: TimelineSelectionChangeEventDetails
  ) => void;
  onSelectionCommitted?: (
    range: readonly [number, number],
    details: TimelineSelectionCommitEventDetails
  ) => void;
}

export interface TimelineController {
  /** Reports the end of a gesture that moved the position. */
  commitSeek: (
    value: number,
    details: TimelinePositionCommitEventDetails
  ) => void;
  getSnapshot: () => TimelineSnapshot;
  /** Handles a key on the ruler: arrows, Page keys, Home and End. Returns `true` when the timeline takes the key. */
  keyDown: (event: KeyboardEvent) => boolean;
  /**
   * Starts a press on the ruler: a press seeks, a drag scrubs, Shift scrubs
   * four times finer; with a selection listener, a drag with Shift held selects
   * a stretch instead. `handle` takes the pointer, `lane` is what it is measured along.
   */
  pressRuler: (event: PointerEvent, handle: Element, lane: Element) => void;
  /**
   * Starts a press that seeks: `lane` is what the position is measured along,
   * `handle` takes the pointer. A drag scrubs, on the grid unless Cmd/Ctrl is
   * held. With `selecting` listeners, a drag selects the stretch from the press
   * to the pointer instead, and the position stays where the press put it.
   */
  pressSeek: (
    event: PointerEvent,
    handle: Element,
    lane: Element,
    selecting?: TimelineSelectionHandlers
  ) => void;
  /** Clamps and proposes a position; returns whether it was applied. */
  seek: (next: number, details: TimelinePositionChangeEventDetails) => boolean;
  setOptions: (options: TimelineOptions) => void;
  setScrubbing: (scrubbing: boolean) => void;
  /** Takes the selection listeners of the ruler; call it whenever they may have changed. */
  setSelection: (handlers: TimelineSelectionHandlers) => void;
  subscribe: (listener: () => void) => () => void;
  /** Sets the position from an input, reporting an `"input-change"` change and commit. */
  typeAt: (value: number, event: Event) => void;
  /** The position of a point at `clientX` on `lane`, in units, clamped to the timeline. */
  valueAt: (lane: Element, clientX: number) => number;
  /** Clamps and proposes a zoom; returns whether it was applied. */
  zoomTo: (next: number, details: TimelineZoomChangeEventDetails) => boolean;
}

/** Holding Shift scrubs this much slower than the pointer moves. */
const FINE_SCRUB = 0.25;

/** The timeline's units under a point of `lane`, clamped to the timeline. */
export function valueAtLane(
  lane: Element,
  clientX: number,
  zoom: number | null,
  duration: number
): number {
  const rect = lane.getBoundingClientRect();
  const unit = zoom ?? rect.width / Math.max(duration, Number.MIN_VALUE);
  const value = (clientX - rect.left) / Math.max(unit, Number.MIN_VALUE);
  return Math.min(duration, Math.max(0, value));
}

/**
 * The timeline's playback position and zoom, with no view attached: held,
 * controlled or live, moved by a press, a drag, a key or an input, and zoomed.
 */
export function createTimelineController(
  initial: TimelineOptions
): TimelineController {
  let options = initial;

  // Held by the timeline, unless `position` or a live `source` is given.
  let uncontrolledPosition = options.defaultPosition ?? 0;
  // The position as the gesture under way left it: a controlled position that
  // lags behind must not pull the timeline back mid-scrub.
  let latest: number | null = null;
  let scrubbing = false;
  let uncontrolledZoom: number | null = options.defaultZoom ?? null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const clampToDuration = (value: number) =>
    clampFinite(value, 0, options.duration);
  const held = (): number =>
    clampToDuration(
      options.source
        ? options.source.getSnapshot()
        : (options.position ?? uncontrolledPosition)
    );
  const current = (): number => latest ?? held();
  const heldZoom = (): number | null =>
    options.zoom === undefined ? uncontrolledZoom : options.zoom;

  let snapshot: TimelineSnapshot | null = null;
  const getSnapshot = (): TimelineSnapshot => {
    const position = scrubbing && latest !== null ? latest : held();
    const zoom = heldZoom();
    const disabled = options.disabled ?? false;
    const { duration } = options;
    if (
      snapshot &&
      snapshot.position === position &&
      snapshot.zoom === zoom &&
      snapshot.scrubbing === scrubbing &&
      snapshot.disabled === disabled &&
      snapshot.duration === duration
    ) {
      return snapshot;
    }
    snapshot = {
      disabled,
      duration,
      fitted: zoom === null,
      position,
      scrubbing,
      zoom,
    };
    return snapshot;
  };

  const seek: TimelineController["seek"] = (raw, details) => {
    const next = clampToDuration(raw);
    if (next === current()) {
      return false;
    }
    options.onPositionChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    latest = next;
    if (options.position === undefined && !options.source) {
      uncontrolledPosition = next;
    }
    notify();
    return true;
  };

  const commitSeek: TimelineController["commitSeek"] = (value, details) => {
    options.onPositionCommitted?.(value, details);
  };

  const zoomTo: TimelineController["zoomTo"] = (next, details) => {
    const clamped = clampZoom(next, options.minZoom, options.maxZoom);
    if (clamped === null || clamped === heldZoom()) {
      return false;
    }
    options.onZoomChange?.(clamped, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.zoom === undefined) {
      uncontrolledZoom = clamped;
    }
    notify();
    return true;
  };

  const setScrubbing: TimelineController["setScrubbing"] = (next) => {
    scrubbing = next;
    if (!next) {
      // The drag is over: the known position rules again.
      latest = null;
    }
    notify();
  };

  const pressSeek: TimelineController["pressSeek"] = (
    event,
    handle,
    lane,
    selecting
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    // The grid applies unless Cmd/Ctrl is held: read from the pointer's own keys.
    const landingAt = (pointer: PointerEvent) => {
      const raw = valueAtLane(
        lane,
        pointer.clientX,
        heldZoom(),
        options.duration
      );
      return bypassesGrid(pointer) ? raw : snapToGrid(raw, options.grid);
    };
    const anchor = landingAt(event);
    const gesture: {
      changed: boolean;
      moved: boolean;
      range: readonly [number, number] | null;
    } = {
      changed: false,
      moved: false,
      range: null,
    };
    setScrubbing(true);
    gesture.changed = seek(anchor, createChangeEventDetails("press", event));
    /** A drag that selects: the stretch from the press to the pointer, once it has length. */
    const select = (move: PointerEvent) => {
      const at = landingAt(move);
      if (at === anchor && gesture.range === null) {
        return;
      }
      const range = [Math.min(anchor, at), Math.max(anchor, at)] as const;
      const details = createChangeEventDetails("drag", move);
      selecting?.onSelectionChange?.(range, details);
      if (!details.isCanceled) {
        gesture.range = range;
      }
    };
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        if (selecting?.onSelectionChange) {
          select(move);
          return;
        }
        gesture.moved = true;
        if (seek(landingAt(move), createChangeEventDetails("drag", move))) {
          gesture.changed = true;
        }
      },
      (end) => {
        // Read before settling: the position falls back to the known value after.
        const committed = current();
        setScrubbing(false);
        if (gesture.changed) {
          commitSeek(committed, {
            event: end,
            reason: gesture.moved ? "drag" : "press",
          } as TimelinePositionCommitEventDetails);
        }
        if (gesture.range) {
          selecting?.onSelectionCommitted?.(gesture.range, {
            event: end,
            reason: "drag",
          });
        }
      }
    );
  };

  const keyDown: TimelineController["keyDown"] = (event) => {
    if (options.disabled) {
      return false;
    }
    const now = current();
    const arrowStep = event.shiftKey ? options.largeStep : options.step;
    const targets: Record<string, number> = {
      ArrowDown: now - arrowStep,
      ArrowLeft: now - arrowStep,
      ArrowRight: now + arrowStep,
      ArrowUp: now + arrowStep,
      End: options.duration,
      Home: 0,
      PageDown: now - options.largeStep,
      PageUp: now + options.largeStep,
    };
    const target = targets[event.key];
    if (target === undefined) {
      return false;
    }
    if (seek(target, createChangeEventDetails("keyboard", event))) {
      commitSeek(current(), {
        event,
        reason: "keyboard",
      } as TimelinePositionCommitEventDetails);
    }
    return true;
  };

  let selection: TimelineSelectionHandlers = {};

  const pressRuler: TimelineController["pressRuler"] = (
    event,
    handle,
    lane
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const landing = (pointer: PointerEvent) => {
      const raw = valueAtLane(
        lane,
        pointer.clientX,
        heldZoom(),
        options.duration
      );
      return bypassesGrid(pointer) ? raw : snapToGrid(raw, options.grid);
    };
    if (event.shiftKey && selection.onSelectionChange) {
      // Shift selects a stretch, as on a DAW's ruler; a plain press seeks.
      const anchor = landing(event);
      const selecting: { range: readonly [number, number] | null } = {
        range: null,
      };
      setScrubbing(true);
      followPointer(
        handle,
        event.pointerId,
        (move) => {
          const at = landing(move);
          const range = [Math.min(anchor, at), Math.max(anchor, at)] as const;
          const details = createChangeEventDetails("drag", move);
          selection.onSelectionChange?.(range, details);
          if (!details.isCanceled) {
            selecting.range = range;
          }
        },
        (end) => {
          setScrubbing(false);
          if (selecting.range) {
            selection.onSelectionCommitted?.(selecting.range, {
              event: end,
              reason: "drag",
            });
          }
        }
      );
      return;
    }
    // Shift scrubs four times finer, measured from where the pointer last moved at full speed.
    const unitOf = () => {
      const rect = handle.getBoundingClientRect();
      return (
        heldZoom() ?? rect.width / Math.max(options.duration, Number.MIN_VALUE)
      );
    };
    let anchor = { clientX: event.clientX, value: landing(event) };
    const gesture: { changed: boolean; moved: boolean } = {
      changed: false,
      moved: false,
    };
    setScrubbing(true);
    gesture.changed = seek(
      anchor.value,
      createChangeEventDetails("press", event)
    );
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        gesture.moved = true;
        let value: number;
        if (move.shiftKey) {
          value =
            anchor.value +
            ((move.clientX - anchor.clientX) / unitOf()) * FINE_SCRUB;
        } else {
          value = landing(move);
          anchor = { clientX: move.clientX, value };
        }
        if (seek(value, createChangeEventDetails("drag", move))) {
          gesture.changed = true;
        }
      },
      (end) => {
        const committed = current();
        setScrubbing(false);
        if (gesture.changed) {
          commitSeek(committed, {
            event: end,
            reason: gesture.moved ? "drag" : "press",
          } as TimelinePositionCommitEventDetails);
        }
      }
    );
  };

  return {
    commitSeek,
    getSnapshot,
    keyDown,
    pressSeek,
    seek,
    pressRuler,
    setSelection: (handlers) => {
      selection = handlers;
    },
    typeAt: (value, event) => {
      if (options.disabled) {
        return;
      }
      if (seek(value, createChangeEventDetails("input-change", event))) {
        commitSeek(current(), {
          event,
          reason: "input-change",
        } as TimelinePositionCommitEventDetails);
      }
    },
    setOptions: (next) => {
      options = next;
      // The props take over again on every render, unless a scrub is under way.
      if (!scrubbing) {
        latest = null;
      }
    },
    setScrubbing,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    valueAt: (lane, clientX) =>
      valueAtLane(lane, clientX, heldZoom(), options.duration),
    zoomTo,
  };
}
