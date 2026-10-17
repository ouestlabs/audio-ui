import { followPointer } from "../../dom/gesture.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import {
  type ClipLimits,
  type ClipValue,
  clipEnd,
  type FadeShape,
  moveClip,
  nextFadeShape,
  setClipFadeIn,
  setClipFadeOut,
  setClipFadeShape,
  trimClipEnd,
  trimClipStart,
} from "./clip.ts";
import {
  bypassesGrid,
  type Grid,
  SNAP_RADIUS_PX,
  snapMove,
  snapSpanMove,
  withoutSnapPoints,
  withSnapRadius,
} from "./snap.ts";

/** What a change to the clip moves. */
export type ClipTarget =
  | "fade-in"
  | "fade-out"
  | "move"
  | "trim-end"
  | "trim-start";

type WithTarget<Details> = Details & {
  /** Whether Alt was held when the drag began: the clip is meant to be copied to where it lands. */
  copy?: boolean;
  /** For a move: how far the clip moved from where it was when the drag began, in the timeline's units. */
  delta?: number;
  /** The lane under the pointer while the clip is dragged, or null when it is over none. */
  lane?: Element | null;
  /** What moved. */
  target: ClipTarget;
};

export type ClipChangeEventDetails = WithTarget<
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>
  | ChangeEventDetails<"double-click", MouseEvent>
>;
export type ClipCommitEventDetails = WithTarget<
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>
  | CommitEventDetails<"double-click", MouseEvent>
>;

/** How far an edge is searched, in the timeline's units: far enough to reach any limit. */
const FAR = 1e12;

export interface ClipOptions {
  /** Whether additive selection reports every press, as one with Shift, Cmd or Ctrl does. */
  additive?: boolean;
  defaultSelected?: boolean;
  /** Uncontrolled starting clip. Defaults to the whole timeline. */
  defaultValue?: ClipValue;
  disabled?: boolean;
  duration: number;
  grid: Grid;
  largeStep: number;
  /** The shortest the clip can be trimmed to, in the timeline's units. */
  minLength: number;
  /** Whether the header, or the keys, can move the clip. */
  movable: boolean;
  onDragOffsetChange?: (offset: number) => void;
  /** Fires when Delete or Backspace is pressed on the clip. */
  onRemove?: (event: KeyboardEvent) => void;
  onSelectedChange?: (
    selected: boolean,
    details: ChangeEventDetails<"press", PointerEvent>
  ) => void;
  onValueChange?: (value: ClipValue, details: ClipChangeEventDetails) => void;
  onValueCommitted?: (
    value: ClipValue,
    details: ClipCommitEventDetails
  ) => void;
  /** The controlled selection. */
  selected?: boolean;
  sourceLength?: number;
  step: number;
  /** The controlled clip. */
  value?: ClipValue;
  /** Whether the timeline's zoom is set: px per unit, or null while it fits its lane. */
  zoom: number | null;
}

export interface ClipSnapshot {
  disabled: boolean;
  /** Whether a pointer is moving, trimming or fading the clip. */
  dragging: boolean;
  /** px the clip has been dragged up or down, while a move is under way. */
  dragOffset: number;
  selected: boolean;
  /** The clip as displayed: the dragged one while a pointer moves it. */
  value: ClipValue;
}

/** The clip as the timeline holds it: finite, on the timeline, fades within its length. */
export function normalizeClip(clip: ClipValue, duration: number): ClipValue {
  const finite = (value: number, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
  const start = Math.min(duration, Math.max(0, finite(clip.start)));
  const length = Math.min(duration - start, Math.max(0, finite(clip.length)));
  const fadeIn = Math.min(length, Math.max(0, finite(clip.fadeIn)));
  const fadeOut = Math.min(length - fadeIn, Math.max(0, finite(clip.fadeOut)));
  return {
    fadeIn,
    fadeInShape: clip.fadeInShape,
    fadeOut,
    fadeOutShape: clip.fadeOutShape,
    length,
    offset: Math.max(0, finite(clip.offset)),
    start,
  };
}

/** The clip a timeline without one starts with: the whole of it, from the source's start. */
export function wholeClip(duration: number): ClipValue {
  return { fadeIn: 0, fadeOut: 0, length: duration, offset: 0, start: 0 };
}

/** The keys' targets for an edge or a clip, moved by the keyboard. */
export function keyTargets(
  current: number,
  step: number,
  largeStep: number,
  shiftKey: boolean,
  bounds: readonly [number, number]
): Record<string, number> {
  const arrowStep = shiftKey ? largeStep : step;
  return {
    ArrowDown: current - arrowStep,
    ArrowLeft: current - arrowStep,
    ArrowRight: current + arrowStep,
    ArrowUp: current + arrowStep,
    End: bounds[1],
    Home: bounds[0],
    PageDown: current - largeStep,
    PageUp: current + largeStep,
  };
}

/** The lane the pointer is over, if any: the element that marks itself as one. */
export function laneUnder(event: PointerEvent): Element | null {
  const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
  return (
    elements?.find((element) => element.hasAttribute("data-timeline-lane")) ??
    null
  );
}

/** The new clip a drag of `target` makes, when the pointer has moved by `delta` units. */
function draggedClip(
  target: ClipTarget,
  origin: ClipValue,
  delta: number,
  grid: Grid,
  limits: ClipLimits
): ClipValue {
  if (target === "move") {
    return moveClip(
      origin,
      snapSpanMove(origin.start + delta, origin.start, origin.length, grid),
      limits
    );
  }
  if (target === "trim-start") {
    return trimClipStart(
      origin,
      snapMove(origin.start + delta, origin.start, grid),
      limits
    );
  }
  if (target === "trim-end") {
    const end = clipEnd(origin);
    return trimClipEnd(origin, snapMove(end + delta, end, grid), limits);
  }
  if (target === "fade-in") {
    return setClipFadeIn(origin, origin.fadeIn + delta);
  }
  return setClipFadeOut(origin, origin.fadeOut - delta);
}

/** The value of an edge of the clip, by the target that moves it. */
function edgeOf(clip: ClipValue, target: EdgeTarget): number {
  if (target === "fade-in") {
    return clip.fadeIn;
  }
  if (target === "fade-out") {
    return clip.fadeOut;
  }
  return target === "trim-start" ? clip.start : clipEnd(clip);
}

/** The clip with an edge set to `to`, as the target moves it, within its limits. */
function clipWithEdge(
  clip: ClipValue,
  target: EdgeTarget,
  to: number,
  limits: ClipLimits
): ClipValue {
  if (target === "trim-start") {
    return trimClipStart(clip, to, limits);
  }
  if (target === "trim-end") {
    return trimClipEnd(clip, to, limits);
  }
  if (target === "fade-in") {
    return setClipFadeIn(clip, to);
  }
  return setClipFadeOut(clip, to);
}

/** Where an edge can go: a fade stops where the other fade meets it, a trim where the source or the timeline does. */
function edgeBounds(
  clip: ClipValue,
  target: EdgeTarget,
  limits: ClipLimits
): readonly [number, number] {
  if (target === "fade-in") {
    return [0, Math.max(0, clip.length - clip.fadeOut)];
  }
  if (target === "fade-out") {
    return [0, Math.max(0, clip.length - clip.fadeIn)];
  }
  if (target === "trim-start") {
    return [
      trimClipStart(clip, -FAR, limits).start,
      trimClipStart(clip, FAR, limits).start,
    ];
  }
  const low = trimClipEnd(clip, -FAR, limits);
  return [low.start + low.length, clipEnd(trimClipEnd(clip, FAR, limits))];
}

/** Whether two clips hold the same values. */
export function sameClip(a: ClipValue, b: ClipValue): boolean {
  return (
    a.start === b.start &&
    a.length === b.length &&
    a.offset === b.offset &&
    a.fadeIn === b.fadeIn &&
    a.fadeOut === b.fadeOut &&
    a.fadeInShape === b.fadeInShape &&
    a.fadeOutShape === b.fadeOutShape
  );
}

interface ClipGesture {
  changed: boolean;
  copy: boolean;
  /** The clip when the pointer went down: the drag is measured from it. */
  origin: ClipValue;
  /** The lane the press began in, so a drop onto another one counts as a change. */
  originLane: Element | null;
  startX: number;
  startY: number;
}

/** The edges a fade or a trim moves. */
type EdgeTarget = "fade-in" | "fade-out" | "trim-start" | "trim-end";

export interface ClipController {
  /** Steps a fade to its next shape, from a double click or the keys. */
  cycleFadeShape: (
    edge: "in" | "out",
    reason: "double-click" | "keyboard",
    event: Event
  ) => void;
  /** Keys on a fade or trim handle: arrows and Page keys move the edge, Home and End go to its limits. Returns `true` when the handle takes the key. */
  edgeKeyDown: (
    target: "fade-in" | "fade-out" | "trim-start" | "trim-end",
    event: KeyboardEvent
  ) => boolean;
  /** The range an edge can take, found by trimming it as far as it goes. */
  edgeRange: (target: EdgeTarget) => readonly [number, number];
  /** An input moves an edge to a position. */
  edgeTypeAt: (
    target: "fade-in" | "fade-out" | "trim-start" | "trim-end",
    to: number,
    event: Event
  ) => void;
  getSnapshot: () => ClipSnapshot;
  /** Keys on the clip itself: Delete removes, arrows move it. Returns `true` when the clip takes the key. */
  keyDown: (event: KeyboardEvent) => boolean;
  /** An input moves the clip to a start. */
  moveTypeAt: (start: number, event: Event) => void;
  /** Starts a drag of `target` from `handle`; `lane` is the one the clip sits on, which turns px into units. */
  press: (
    target: ClipTarget,
    event: PointerEvent,
    handle: Element,
    lane: Element | null
  ) => void;
  /** Marks the clip selected, from a press on it. */
  select: (event: PointerEvent) => void;
  setOptions: (options: ClipOptions) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A clip's behavior with no view attached: its span, held or controlled,
 * moved, trimmed or faded by the pointer or the keys, and selected.
 */
export function createClipController(initial: ClipOptions): ClipController {
  let options = initial;
  const limits = (): ClipLimits => ({
    duration: options.duration,
    minLength: options.minLength,
    sourceLength: options.sourceLength,
  });

  let uncontrolled: ClipValue | undefined;
  // The clip as the gesture under way left it; reset on every render, unless a drag is under way.
  let latest: ClipValue | null = null;
  let dragging = false;
  let dragOffset = 0;
  let gesture: ClipGesture | null = null;
  let uncontrolledSelected = options.defaultSelected ?? false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const held = (): ClipValue =>
    normalizeClip(
      options.value ??
        uncontrolled ??
        options.defaultValue ??
        wholeClip(options.duration),
      options.duration
    );
  const current = (): ClipValue => latest ?? held();
  const isSelected = () => options.selected ?? uncontrolledSelected;

  let snapshot: ClipSnapshot | null = null;
  const getSnapshot = (): ClipSnapshot => {
    const value = dragging && latest !== null ? latest : held();
    const disabled = options.disabled ?? false;
    const selected = isSelected();
    if (
      snapshot &&
      sameClip(snapshot.value, value) &&
      snapshot.dragging === dragging &&
      snapshot.disabled === disabled &&
      snapshot.selected === selected &&
      snapshot.dragOffset === dragOffset
    ) {
      return snapshot;
    }
    snapshot = { disabled, dragging, dragOffset, selected, value };
    return snapshot;
  };

  /** Reports a change; keeps it unless canceled. */
  const change = (next: ClipValue, details: ClipChangeEventDetails) => {
    if (sameClip(next, current())) {
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

  const commit = (value: ClipValue, details: ClipCommitEventDetails) => {
    options.onValueCommitted?.(value, details);
  };

  const setDragOffset = (pixels: number) => {
    dragOffset = pixels;
    options.onDragOffsetChange?.(pixels);
    notify();
  };

  const setDragging = (next: boolean) => {
    dragging = next;
    if (!next) {
      latest = null;
      setDragOffset(0);
    }
    notify();
  };

  const select = (event: PointerEvent) => {
    // A selected clip is not reported again, unless the press carries Shift,
    // Cmd or Ctrl, or the clip is additive: that is how a selection is built.
    if (
      isSelected() &&
      !(options.additive || event.shiftKey || event.metaKey || event.ctrlKey)
    ) {
      return;
    }
    const details = createChangeEventDetails("press", event);
    options.onSelectedChange?.(true, details);
    if (!details.isCanceled && options.selected === undefined) {
      uncontrolledSelected = true;
      notify();
    }
  };

  const unitsPerPixel = (lane: Element | null) => {
    if (options.zoom !== null) {
      return 1 / options.zoom;
    }
    const width = lane?.getBoundingClientRect().width ?? 0;
    return options.duration / Math.max(width, 1);
  };

  const press: ClipController["press"] = (target, event, handle, lane) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    if (target === "move" && !options.movable) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const started: ClipGesture = {
      changed: false,
      copy: target === "move" && event.altKey,
      origin: current(),
      originLane: target === "move" ? laneUnder(event) : null,
      startX: event.clientX,
      startY: event.clientY,
    };
    gesture = started;
    select(event);
    dragging = true;
    notify();
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        const units = unitsPerPixel(lane);
        const delta = (move.clientX - started.startX) * units;
        // The clip's own edges are not places for it to snap to.
        const grid = bypassesGrid(move)
          ? { offset: 0, step: 0 }
          : withSnapRadius(
              withoutSnapPoints(options.grid, [
                started.origin.start,
                clipEnd(started.origin),
              ]),
              units * SNAP_RADIUS_PX
            );
        const next = draggedClip(target, started.origin, delta, grid, limits());
        if (target === "move") {
          setDragOffset(move.clientY - started.startY);
        }
        const details = Object.assign(createChangeEventDetails("drag", move), {
          copy: started.copy,
          delta:
            target === "move" ? next.start - started.origin.start : undefined,
          lane: target === "move" ? laneUnder(move) : undefined,
          target,
        }) as ClipChangeEventDetails;
        if (change(next, details)) {
          started.changed = true;
        }
      },
      (end) => {
        const finished = gesture;
        gesture = null;
        // Read before settling: the clip falls back to the known value after.
        const committed = current();
        const dropLane = target === "move" ? laneUnder(end) : undefined;
        setDragging(false);
        const didChange = finished?.changed ?? false;
        if (didChange || (dropLane && dropLane !== started.originLane)) {
          commit(committed, {
            copy: started.copy,
            delta:
              target === "move"
                ? committed.start - started.origin.start
                : undefined,
            event: end,
            lane: dropLane,
            reason: "drag",
            target,
          } as ClipCommitEventDetails);
        }
      }
    );
  };

  /** Moves the whole clip so it starts at `start`, from an input or the keys. */
  const moveTo = (
    start: number,
    reason: "input-change" | "keyboard",
    event: Event
  ) => {
    if (options.disabled || !options.movable) {
      return;
    }
    const next = moveClip(current(), start, limits());
    const details = Object.assign(createChangeEventDetails(reason, event), {
      target: "move" as const,
    }) as ClipChangeEventDetails;
    if (change(next, details)) {
      commit(current(), {
        event,
        reason,
        target: "move",
      } as ClipCommitEventDetails);
    }
  };

  const keyDown: ClipController["keyDown"] = (event) => {
    if (options.disabled) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      options.onRemove?.(event);
      return true;
    }
    if (!options.movable) {
      return false;
    }
    const latestClip = current();
    const targets = keyTargets(
      latestClip.start,
      options.step,
      options.largeStep,
      event.shiftKey,
      [0, Math.max(0, options.duration - latestClip.length)]
    );
    const to = targets[event.key];
    if (to === undefined) {
      return false;
    }
    moveTo(to, "keyboard", event);
    return true;
  };

  const edgeRange: ClipController["edgeRange"] = (target) =>
    edgeBounds(current(), target, limits());

  /** Sets a fade or trims an edge to `to`, reporting the change as `reason`. */
  const setEdge = (
    target: EdgeTarget,
    to: number,
    reason: "input-change" | "keyboard",
    event: Event
  ) => {
    const next = clipWithEdge(current(), target, to, limits());
    const details = Object.assign(createChangeEventDetails(reason, event), {
      target,
    }) as ClipChangeEventDetails;
    if (change(next, details)) {
      commit(current(), { event, reason, target } as ClipCommitEventDetails);
    }
  };

  const edgeKeyDown: ClipController["edgeKeyDown"] = (target, event) => {
    if (options.disabled) {
      return false;
    }
    const clip = current();
    const to = keyTargets(
      edgeOf(clip, target),
      options.step,
      options.largeStep,
      event.shiftKey,
      edgeBounds(clip, target, limits())
    )[event.key];
    if (to === undefined) {
      return false;
    }
    event.preventDefault();
    setEdge(target, to, "keyboard", event);
    return true;
  };

  const cycleFadeShape: ClipController["cycleFadeShape"] = (
    edge,
    reason,
    event
  ) => {
    if (options.disabled) {
      return;
    }
    const latestClip = current();
    const shape: FadeShape = nextFadeShape(
      edge === "in" ? latestClip.fadeInShape : latestClip.fadeOutShape
    );
    const next = setClipFadeShape(latestClip, edge, shape);
    const target = edge === "in" ? "fade-in" : "fade-out";
    const details = Object.assign(createChangeEventDetails(reason, event), {
      target,
    }) as ClipChangeEventDetails;
    if (change(next, details)) {
      commit(current(), { event, reason, target } as ClipCommitEventDetails);
    }
  };

  return {
    cycleFadeShape,
    edgeKeyDown,
    edgeRange,
    edgeTypeAt: (target, to, event) => {
      if (!options.disabled) {
        setEdge(target, to, "input-change", event);
      }
    },
    getSnapshot,
    keyDown,
    moveTypeAt: (start, event) => moveTo(start, "input-change", event),
    press,
    select,
    setOptions: (next) => {
      options = next;
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
