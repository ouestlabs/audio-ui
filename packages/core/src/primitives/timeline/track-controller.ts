import { followPointer } from "../../dom/gesture";
import { clamp } from "../../shared/math";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events";

export type TrackHeightChangeEventDetails =
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>
  | ChangeEventDetails<"double-click", MouseEvent>;
export type TrackHeightCommitEventDetails =
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>
  | CommitEventDetails<"double-click", MouseEvent>;

export interface TrackOptions {
  /** The height in px, or `undefined` for the row to share what room there is. */
  height?: number;
  largeStep: number;
  max: number;
  /** Measures the row as drawn: what a track without a height is, while it is resized. */
  measure: () => number;
  min: number;
  onHeightChange?: (
    height: number | undefined,
    details: TrackHeightChangeEventDetails
  ) => void;
  onHeightCommitted?: (
    height: number | undefined,
    details: TrackHeightCommitEventDetails
  ) => void;
  step: number;
}

export interface TrackSnapshot {
  /** Whether a pointer is resizing the track. */
  resizing: boolean;
}

export interface TrackController {
  getSnapshot: () => TrackSnapshot;
  /** Handles a key on the handle's input: the arrows move by a step (Down is taller), Page keys by a large one, Home and End go to the limits. Returns whether the key was the handle's. */
  keyDown: (event: KeyboardEvent) => boolean;
  /** Starts a drag from `handle`: the height moves with the pointer, measured from where it was taken. */
  press: (event: PointerEvent, handle: Element) => void;
  /** Gives the height up, so the row shares the room again. */
  reset: (event: MouseEvent) => void;
  /** Asks for a new height: a drag, a key or an input. Returns whether the request was applied. */
  resize: (height: number, details: TrackHeightChangeEventDetails) => boolean;
  setOptions: (options: TrackOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** Sets the height from an input, committing it when it applies. */
  typeAt: (value: number, event: Event) => void;
}

/**
 * A track's height, with no view attached: what a drag, a key, an input or a
 * double click asks of it. The track holds no height of its own: the parent
 * sets it, and the controller reports each request.
 */
export function createTrackController(initial: TrackOptions): TrackController {
  let options = initial;
  let resizing = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  /** What the track is now: the height it was given, or what it measures. */
  const current = () => options.height ?? options.measure();

  let snapshot: TrackSnapshot | null = null;
  const getSnapshot = (): TrackSnapshot => {
    if (snapshot?.resizing === resizing) {
      return snapshot;
    }
    snapshot = { resizing };
    return snapshot;
  };

  const resize: TrackController["resize"] = (height, details) => {
    const clamped = clamp(height, options.min, options.max);
    if (clamped === options.height) {
      return false;
    }
    options.onHeightChange?.(clamped, details);
    return !details.isCanceled;
  };

  const commit = (
    height: number | undefined,
    details: TrackHeightCommitEventDetails
  ) => {
    options.onHeightCommitted?.(height, details);
  };

  const reset: TrackController["reset"] = (event) => {
    if (options.height === undefined) {
      return;
    }
    const details = createChangeEventDetails(
      "double-click",
      event
    ) as TrackHeightChangeEventDetails;
    options.onHeightChange?.(undefined, details);
    if (!details.isCanceled) {
      commit(undefined, {
        event,
        reason: "double-click",
      } as TrackHeightCommitEventDetails);
    }
  };

  /** Asks for `to` from a key or an input, committing it when it applies. */
  const setHeight = (
    to: number,
    reason: "input-change" | "keyboard",
    event: Event
  ) => {
    const details = createChangeEventDetails(
      reason,
      event
    ) as TrackHeightChangeEventDetails;
    if (resize(to, details)) {
      commit(clamp(to, options.min, options.max), {
        event,
        reason,
      } as TrackHeightCommitEventDetails);
    }
  };

  const press: TrackController["press"] = (event, handle) => {
    if (event.button !== 0) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const from = current();
    const started: {
      changed: boolean;
      from: number;
      latest: number;
      startY: number;
    } = {
      changed: false,
      from,
      latest: from,
      startY: event.clientY,
    };
    resizing = true;
    notify();
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        const next = started.from + move.clientY - started.startY;
        const details = createChangeEventDetails(
          "drag",
          move
        ) as TrackHeightChangeEventDetails;
        if (resize(next, details)) {
          started.changed = true;
          started.latest = clamp(next, options.min, options.max);
        }
      },
      (end) => {
        resizing = false;
        notify();
        if (started.changed) {
          commit(started.latest, {
            event: end,
            reason: "drag",
          } as TrackHeightCommitEventDetails);
        }
      }
    );
  };

  const keyDown: TrackController["keyDown"] = (event) => {
    const now = current();
    const targets: Record<string, number> = {
      ArrowDown: now + options.step,
      ArrowLeft: now - options.step,
      ArrowRight: now + options.step,
      ArrowUp: now - options.step,
      End: options.max,
      Home: options.min,
      PageDown: now + options.largeStep,
      PageUp: now - options.largeStep,
    };
    const to = targets[event.key];
    if (to === undefined) {
      return false;
    }
    setHeight(to, "keyboard", event);
    return true;
  };

  return {
    getSnapshot,
    keyDown,
    press,
    reset,
    resize,
    setOptions: (next) => {
      options = next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    typeAt: (value, event) => setHeight(value, "input-change", event),
  };
}
