import type * as React from "react";
import type { TimelineContextValue } from "../context.ts";

/**
 * Pointer handlers that move the position from a press on the lane's own bare
 * area: a press jumps to the pointer and a drag scrubs, on the grid unless
 * Cmd/Ctrl is held. A press on a part placed in the lane goes to that part.
 * The gesture itself is the timeline controller's.
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
  const { controller, state } = context;

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
    controller.pressSeek(
      event.nativeEvent,
      event.currentTarget,
      measure?.() ?? event.currentTarget
    );
  };

  return { onPointerDown };
}
