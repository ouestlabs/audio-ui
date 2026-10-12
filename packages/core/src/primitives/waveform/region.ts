import { followPointer } from "../../dom/gesture.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import {
  moveRange,
  normalizeRange,
  type RangeEdge,
  type RangeValue,
} from "../../value/range.ts";

export type WaveformRegionEdge = RangeEdge;
export type WaveformRegionValue = RangeValue;

export type WaveformRegionChangeEventDetails = (
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>
) & { edge: WaveformRegionEdge };
export type WaveformRegionCommitEventDetails = (
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>
) & { edge: WaveformRegionEdge };

/** Keys move an edge by this share of the timeline, a large step with Shift or Page Up/Down. */
export interface WaveformRegionOptions {
  /** Uncontrolled starting region. Defaults to the whole timeline. */
  defaultValue?: WaveformRegionValue;
  disabled?: boolean;
  duration: number;
  largeStep: number;
  /** The shortest the region can be resized to, in `duration` units. */
  minLength: number;
  onValueChange?: (
    value: WaveformRegionValue,
    details: WaveformRegionChangeEventDetails
  ) => void;
  onValueCommitted?: (
    value: WaveformRegionValue,
    details: WaveformRegionCommitEventDetails
  ) => void;
  step: number;
  /** The region, as `[start, end]` in `duration` units. */
  value?: WaveformRegionValue;
}

/** What a view draws a region from. */
export interface WaveformRegionSnapshot {
  disabled: boolean;
  /** Whether a pointer is moving or resizing the region. */
  dragging: boolean;
  duration: number;
  largeStep: number;
  minLength: number;
  step: number;
  /** The region as displayed: the dragged one while a pointer moves it. */
  value: WaveformRegionValue;
}

export interface WaveformRegionController {
  /** How far an edge can go: the limits of its position, which stop short of the other edge. */
  edgeRange: (edge: WaveformRegionEdge) => readonly [number, number];
  getSnapshot: () => WaveformRegionSnapshot;
  /** Handles a key on an edge's input: arrows and Page keys move it, Home and End go to its ends. Returns `true` when the edge takes the key. */
  keyDown: (edge: WaveformRegionEdge, event: KeyboardEvent) => boolean;
  /**
   * Starts a drag of `edge` (or of the whole region, `"both"`) from `handle`.
   * `track` is the element the region sits on, which turns pixels into
   * `duration` units: a drag measures it as it moves.
   */
  press: (
    edge: WaveformRegionEdge,
    event: PointerEvent,
    handle: Element,
    track: Element | null,
    shownRange: readonly [number, number]
  ) => void;
  setOptions: (options: WaveformRegionOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** Moves an edge to a position from an input. */
  typeAt: (edge: WaveformRegionEdge, position: number, event: Event) => void;
}

/** One drag, from press to release. */
interface RegionGesture {
  /** Whether the gesture changed the region at least once; if so its end commits. */
  changed: boolean;
  /** The region when the pointer went down: the drag is measured from it. */
  origin: WaveformRegionValue;
  startX: number;
}

/**
 * A region's behavior with no view attached: its span on the timeline, held
 * or controlled, every way of moving it by its body or its edges, and the
 * keys and input that move an edge.
 */
export function createWaveformRegionController(
  initial: WaveformRegionOptions
): WaveformRegionController {
  let options = initial;
  const limits = () => ({
    duration: options.duration,
    minLength: options.minLength,
  });

  // Held by the region, unless `value` is given.
  let uncontrolled: WaveformRegionValue | undefined;
  // The region as the gesture under way left it: a controlled region that
  // lags behind must not pull it back mid-drag.
  let latest: WaveformRegionValue | null = null;
  let dragging = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const held = (): WaveformRegionValue =>
    normalizeRange(
      options.value ??
        uncontrolled ??
        options.defaultValue ?? [0, options.duration],
      options.duration
    );
  const current = (): WaveformRegionValue => latest ?? held();

  let snapshot: WaveformRegionSnapshot | null = null;
  const getSnapshot = (): WaveformRegionSnapshot => {
    const value = dragging && latest !== null ? latest : held();
    const disabled = options.disabled ?? false;
    const { duration, largeStep, minLength, step } = options;
    if (
      snapshot &&
      snapshot.value[0] === value[0] &&
      snapshot.value[1] === value[1] &&
      snapshot.dragging === dragging &&
      snapshot.disabled === disabled &&
      snapshot.duration === duration &&
      snapshot.largeStep === largeStep &&
      snapshot.minLength === minLength &&
      snapshot.step === step
    ) {
      return snapshot;
    }
    snapshot = {
      disabled,
      dragging,
      duration,
      largeStep,
      minLength,
      step,
      value,
    };
    return snapshot;
  };

  /** Proposes a region; keeps it unless canceled. Returns `true` when the region is applied. */
  const change = (
    next: WaveformRegionValue,
    details: WaveformRegionChangeEventDetails
  ): boolean => {
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

  const commit = (
    value: WaveformRegionValue,
    details: WaveformRegionCommitEventDetails
  ) => {
    options.onValueCommitted?.(value, details);
  };

  /**
   * The region with `edge` moved to `position`, measured from the region as
   * it is now, keeping within its limits.
   */
  const withEdgeAt = (
    edge: WaveformRegionEdge,
    position: number
  ): WaveformRegionValue => {
    const now = current();
    const from = edge === "start" ? now[0] : now[1];
    return moveRange(now, edge, position - from, limits());
  };

  /** The limits of an edge: how far it can go before it meets the other one. */
  const edgeLimits = (edge: WaveformRegionEdge): readonly [number, number] => {
    const [start, end] = current();
    const { duration, minLength } = options;
    if (edge === "start") {
      return [0, Math.max(0, end - minLength)];
    }
    return [Math.min(duration, start + minLength), duration];
  };

  const press: WaveformRegionController["press"] = (
    edge,
    event,
    handle,
    track,
    shownRange
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const gesture: RegionGesture = {
      changed: false,
      origin: current(),
      startX: event.clientX,
    };
    dragging = true;
    notify();
    // Pixels become `duration` units by the stretch shown, over the track it sits on.
    const unitsPerPixel = () => {
      const width = track?.getBoundingClientRect().width ?? 0;
      return (shownRange[1] - shownRange[0]) / Math.max(width, 1);
    };
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        const delta = (move.clientX - gesture.startX) * unitsPerPixel();
        const next = moveRange(gesture.origin, edge, delta, limits());
        if (
          change(
            next,
            Object.assign(createChangeEventDetails("drag", move), {
              edge,
            }) as WaveformRegionChangeEventDetails
          )
        ) {
          gesture.changed = true;
        }
      },
      (end) => {
        // Read before settling: the region falls back to the known value after.
        const committed = current();
        dragging = false;
        latest = null;
        notify();
        if (gesture.changed) {
          commit(committed, {
            edge,
            event: end,
            reason: "drag",
          } as WaveformRegionCommitEventDetails);
        }
      }
    );
  };

  const keyDown: WaveformRegionController["keyDown"] = (edge, event) => {
    if (options.disabled) {
      return false;
    }
    const [min, max] = edgeLimits(edge);
    const at = edge === "start" ? current()[0] : current()[1];
    const arrowStep = event.shiftKey ? options.largeStep : options.step;
    const targets: Record<string, number> = {
      ArrowDown: at - arrowStep,
      ArrowLeft: at - arrowStep,
      ArrowRight: at + arrowStep,
      ArrowUp: at + arrowStep,
      End: max,
      Home: min,
      PageDown: at - options.largeStep,
      PageUp: at + options.largeStep,
    };
    const position = targets[event.key];
    if (position === undefined) {
      return false;
    }
    const details = Object.assign(createChangeEventDetails("keyboard", event), {
      edge,
    }) as WaveformRegionChangeEventDetails;
    if (change(withEdgeAt(edge, position), details)) {
      commit(current(), {
        edge,
        event,
        reason: "keyboard",
      } as WaveformRegionCommitEventDetails);
    }
    return true;
  };

  const typeAt: WaveformRegionController["typeAt"] = (
    edge,
    position,
    event
  ) => {
    if (options.disabled) {
      return;
    }
    const details = Object.assign(
      createChangeEventDetails("input-change", event),
      { edge }
    ) as WaveformRegionChangeEventDetails;
    if (change(withEdgeAt(edge, position), details)) {
      commit(current(), {
        edge,
        event,
        reason: "input-change",
      } as WaveformRegionCommitEventDetails);
    }
  };

  return {
    edgeRange: edgeLimits,
    getSnapshot,
    keyDown,
    press,
    setOptions: (next) => {
      options = next;
      // The props take over again on every render, unless a drag is under way.
      if (!dragging) {
        latest = null;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    typeAt,
  };
}
