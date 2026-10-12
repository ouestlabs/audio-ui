import type { ClipController, ClipTarget } from "@audio-ui/core/timeline";
import * as React from "react";
import type { DescribePosition } from "../context";

export type {
  ClipChangeEventDetails,
  ClipCommitEventDetails,
  ClipTarget,
} from "@audio-ui/core/timeline";
export { keyTargets } from "@audio-ui/core/timeline";

import type { ClipValue } from "@audio-ui/core/timeline";

export type ClipState = {
  disabled: boolean;
  /** Whether a pointer is moving, trimming or fading the clip. */
  dragging: boolean;
  selected: boolean;
};

export interface ClipContextValue {
  /** The framework-free clip behind every part: its span, selection, drags and keys. */
  controller: ClipController;
  /** Gives the clip's input the focus, so the keyboard follows a press on a part of it. */
  focus: () => void;
  /** The lane the clip sits on: what a pointer's px are measured along. */
  laneRef: React.RefObject<HTMLElement | null>;
  meta: {
    describe: DescribePosition;
    duration: number;
    largeStep: number;
    /** Whether the header, or the keys, can move the clip. */
    movable: boolean;
    step: number;
    /** The clip as displayed. */
    value: ClipValue;
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

/**
 * Pointer handler for one gesture on the clip: `target` says what the drag
 * moves. The press stops here, so the lane underneath doesn't take it.
 */
export function useClipDrag(
  context: ClipContextValue,
  target: ClipTarget,
  enabled: boolean
) {
  const { controller, laneRef } = context;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (!enabled) {
      return;
    }
    event.preventDefault();
    controller.press(
      target,
      event.nativeEvent,
      event.currentTarget,
      laneRef.current
    );
  };

  return { onPointerDown };
}
