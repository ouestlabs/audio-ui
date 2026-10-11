import * as React from "react";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "../../internal/event-details";
import { isReleased } from "../../internal/pointer";
import type { ClipLimits, ClipValue } from "../clip";
import type { DescribePosition } from "../context";
import { bypassesGrid, type Grid } from "../internal/snap";

/** What a change to the clip moves. */
export type ClipTarget =
  | "fade-in"
  | "fade-out"
  | "move"
  | "trim-end"
  | "trim-start";

type WithTarget<Details> = Details & {
  /**
   * For a move: how far the clip is from where it was when the drag began, in
   * the timeline's units, so a group can be moved by the same amount.
   */
  delta?: number;
  /** Whether Alt was held when the drag began: the clip is meant to be copied to where it lands, not moved. */
  copy?: boolean;
  /** The lane under the pointer while the clip is dragged, or null when it is over none. */
  lane?: HTMLElement | null;
  /** What moved. */
  target: ClipTarget;
};

export type ClipChangeEventDetails =
  | WithTarget<ExtraChangeEventDetails<"drag", PointerEvent>>
  | WithTarget<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
  | WithTarget<ExtraChangeEventDetails<"input-change", Event>>
  | WithTarget<ExtraChangeEventDetails<"double-click", MouseEvent>>;

export type ClipCommitEventDetails =
  | WithTarget<ExtraCommitEventDetails<"drag", PointerEvent>>
  | WithTarget<ExtraCommitEventDetails<"keyboard", KeyboardEvent>>
  | WithTarget<ExtraCommitEventDetails<"input-change", Event>>
  | WithTarget<ExtraCommitEventDetails<"double-click", MouseEvent>>;

export type ClipState = {
  disabled: boolean;
  /** Whether a pointer is moving, trimming or fading the clip. */
  dragging: boolean;
  selected: boolean;
};

export interface ClipContextValue {
  actions: {
    /** Propose a clip; returns whether it was applied. */
    change: (next: ClipValue, eventDetails: ClipChangeEventDetails) => boolean;
    commit: (value: ClipValue, eventDetails: ClipCommitEventDetails) => void;
    /** Gives the clip's input the focus, so the keyboard follows a press on a part of it. */
    focus: () => void;
    /** Marks the clip selected, from a press on it. */
    select: (event: PointerEvent) => void;
    setDragging: (dragging: boolean) => void;
    setDragOffset: (offset: number) => void;
    /** The timeline's units covered by one px of the lane. */
    unitsPerPixel: () => number;
  };
  meta: {
    describe: DescribePosition;
    duration: number;
    grid: Grid;
    largeStep: number;
    limits: ClipLimits;
    /** Whether the header, or the keys, can move the clip. */
    movable: boolean;
    step: number;
    /** The clip as displayed. */
    value: ClipValue;
    /** Latest displayed clip, readable from event handlers. */
    valueRef: React.RefObject<ClipValue>;
  };
  state: ClipState;
}

export const ClipContext = React.createContext<ClipContextValue | null>(null);

export function useClipContext(part: string): ClipContextValue {
  const context = React.use(ClipContext);
  if (!context) {
    throw new Error(`Timeline.${part} must be used within Timeline.Clip`);
  }
  return context;
}

interface DragGesture {
  /** Whether the gesture changed the clip at least once; if so its end commits. */
  changed: boolean;
  /** Whether Alt was held at the press. */
  copy: boolean;
  /** The clip when the pointer went down: the drag is measured from it. */
  origin: ClipValue;
  /** The lane the press began in, so a drop onto another one counts as a change. */
  originLane: HTMLElement | null;
  pointerId: number;
  startX: number;
  startY: number;
}

/** The lane the pointer is over, if any. */
function laneUnder(event: PointerEvent): HTMLElement | null {
  const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
  const lane = elements?.find((element) =>
    element.hasAttribute("data-timeline-lane")
  );
  return (lane as HTMLElement | undefined) ?? null;
}

/**
 * Pointer handlers for one gesture on the clip: `next` says where the clip
 * ends up when the pointer has moved by `delta` units. The press stops here,
 * so the lane underneath doesn't take it. A move also follows the pointer
 * vertically and reports the lane it is over.
 */
export function useClipDrag(
  context: ClipContextValue,
  target: ClipTarget,
  enabled: boolean,
  next: (
    origin: ClipValue,
    delta: number,
    grid: Grid,
    limits: ClipLimits
  ) => ClipValue
) {
  const { actions, meta } = context;
  const gestureRef = React.useRef<DragGesture | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (!enabled) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = {
      changed: false,
      copy: target === "move" && event.altKey,
      origin: meta.valueRef.current,
      originLane: target === "move" ? laneUnder(event.nativeEvent) : null,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    actions.select(event.nativeEvent);
    actions.setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      onPointerEnd(event);
      return;
    }
    event.stopPropagation();
    const delta = (event.clientX - gesture.startX) * actions.unitsPerPixel();
    const grid = bypassesGrid(event) ? { offset: 0, step: 0 } : meta.grid;
    const value = next(gesture.origin, delta, grid, meta.limits);
    const eventDetails = Object.assign(
      createChangeEventDetails("drag", event.nativeEvent),
      {
        copy: gesture.copy,
        delta:
          target === "move" ? value.start - gesture.origin.start : undefined,
        lane: target === "move" ? laneUnder(event.nativeEvent) : undefined,
        target,
      }
    );
    if (target === "move") {
      actions.setDragOffset(event.clientY - gesture.startY);
    }
    if (actions.change(value, eventDetails)) {
      gesture.changed = true;
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the clip falls back to the known value after.
    const committed = meta.valueRef.current;
    const lane = target === "move" ? laneUnder(event.nativeEvent) : undefined;
    actions.setDragging(false);
    if (gesture.changed || (lane && lane !== gesture.originLane)) {
      actions.commit(committed, {
        copy: gesture.copy,
        delta:
          target === "move"
            ? committed.start - gesture.origin.start
            : undefined,
        event: event.nativeEvent,
        lane,
        reason: "drag",
        target,
      });
    }
  };

  return {
    onLostPointerCapture: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
  };
}

/** Arrow, Page and Home/End targets for a value moved by the keyboard. */
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
