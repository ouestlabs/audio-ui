import { createChangeEventDetails, isReleased } from "@audio-ui/core";
import { bypassesGrid, snapToGrid } from "@audio-ui/core/timeline";
import * as React from "react";
import { type TimelineContextValue, valueAtPointer } from "../context";

interface SeekGesture {
  /** Whether the gesture moved the position at least once; if so its end commits. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
}

/**
 * Pointer handlers that move the position from a press on the lane's own bare
 * area: a press jumps to the pointer and a drag scrubs, on the grid unless
 * Cmd/Ctrl is held. A press on a part placed in the lane goes to that part.
 */
export function useSeekGesture(
  context: TimelineContextValue,
  options: {
    enabled: boolean;
    /** The lane the position is measured along. Defaults to the element pressed. */
    measure?: () => HTMLElement | null;
    /** Whether a press is a seek: by default only a press on the element itself. */
    accepts?: (event: React.PointerEvent<HTMLElement>) => boolean;
    /** Runs for a press that seeks. */
    onPress?: (event: PointerEvent) => void;
  }
) {
  const { enabled, measure, accepts, onPress } = options;
  const { actions, meta, state } = context;
  const { duration, grid, position, zoom } = meta;
  const gestureRef = React.useRef<SeekGesture | null>(null);

  const landingAt = (event: React.PointerEvent<HTMLElement>) => {
    const raw = valueAtPointer(
      measure?.() ?? event.currentTarget,
      event.clientX,
      zoom,
      duration
    );
    return bypassesGrid(event) ? raw : snapToGrid(raw, grid);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (
      !enabled ||
      state.disabled ||
      event.button !== 0 ||
      !(accepts ? accepts(event) : event.target === event.currentTarget)
    ) {
      return;
    }
    onPress?.(event.nativeEvent);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const gesture: SeekGesture = {
      changed: false,
      moved: false,
      pointerId: event.pointerId,
    };
    gestureRef.current = gesture;
    actions.setScrubbing(true);
    gesture.changed = actions.seek(
      landingAt(event),
      createChangeEventDetails("press", event.nativeEvent)
    );
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the position falls back to the known value after.
    const committed = position.get();
    actions.setScrubbing(false);
    if (gesture.changed) {
      actions.commitSeek(committed, {
        event: event.nativeEvent,
        reason: gesture.moved ? "drag" : "press",
      });
    }
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
    gesture.moved = true;
    if (
      actions.seek(
        landingAt(event),
        createChangeEventDetails("drag", event.nativeEvent)
      )
    ) {
      gesture.changed = true;
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
