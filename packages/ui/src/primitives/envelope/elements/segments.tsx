import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import {
  type Breakpoint,
  curveForMidpoint,
  curveKeyDelta,
  segmentShape,
} from "../internal/geometry";
import type { Root } from "./root";

/** Renders one child per segment between two points, in `x` order. */
export function Segments({ children }: Segments.Props) {
  const { state } = useEnvelopeContext("Segments");
  return (
    <>
      {state.value
        .slice(0, -1)
        .map((point, index) => children(point, index, state.value))}
    </>
  );
}

export namespace Segments {
  export interface Props {
    children: (
      /** The point the segment leaves from, which holds its `curve`. */
      point: Breakpoint,
      index: number,
      points: Breakpoint[]
    ) => React.ReactNode;
  }
}

interface SegmentGesture {
  changed: boolean;
  pointerId: number;
}

/**
 * A handle on the middle of the segment leaving the point at `index`: drag it
 * up or down to bend the segment, so it follows the pointer on the curve's
 * midpoint. A `role="slider"` on the curve (-1…1): one handle at a time is
 * the tab stop, Left and Right move between them, Up and Down bend it (Shift
 * for larger steps), and a double click or Delete straightens it. A segment
 * between two points of the same level has nothing to bend, and `data-flat`
 * says so. Renders a `<div>` element.
 */
export function Segment(componentProps: Segment.Props) {
  const {
    className,
    getAriaValueText,
    index,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useEnvelopeContext("Segment");
  const from = state.value[index];
  const to = state.value[index + 1];
  const gestureRef = React.useRef<SegmentGesture | null>(null);
  const { registerSegment } = actions;
  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => registerSegment(index, node),
    [index, registerSegment]
  );
  const curve = from?.curve ?? 0;
  const flat = from && to ? Math.abs(to.y - from.y) < 1e-6 : true;

  const segmentState = React.useMemo<Segment.State>(
    () => ({
      curve,
      disabled: state.disabled,
      dragging: meta.draggingSegmentIndex === index,
      flat,
      index,
      value: state.value,
    }),
    [curve, flat, index, meta.draggingSegmentIndex, state.disabled, state.value]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || flat || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus({ focusVisible: false, preventScroll: true });
    gestureRef.current = { changed: false, pointerId: event.pointerId };
    actions.setDraggingSegment(index);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const graph = meta.graphRef.current;
    const left = meta.valueRef.current[index];
    const right = meta.valueRef.current[index + 1];
    if (!(gesture && graph && left && right)) {
      return;
    }
    if (gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    const rect = graph.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }
    const next = curveForMidpoint(
      left,
      right,
      1 - (event.clientY - rect.top) / rect.height
    );
    if (next === null) {
      return;
    }
    const moved = actions.setCurve(
      index,
      next,
      Object.assign(createChangeEventDetails("curve", event.nativeEvent), {
        index,
      })
    );
    if (moved) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    actions.setDraggingSegment(null);
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, {
        event: event.nativeEvent,
        index,
        reason: "curve",
      });
    }
  };

  const straighten = (native: MouseEvent | KeyboardEvent) => {
    const moved = actions.setCurve(
      index,
      0,
      Object.assign(createChangeEventDetails("curve", native), { index })
    );
    if (moved) {
      actions.commit(meta.valueRef.current, {
        event: native,
        index,
        reason: "curve",
      });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!state.disabled) {
      straighten(event.nativeEvent);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const left = meta.valueRef.current[index];
    const right = meta.valueRef.current[index + 1];
    if (state.disabled || !(left && right)) {
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      actions.focusSegment(index + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (flat) {
      return;
    }
    const native = event.nativeEvent;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      straighten(native);
      return;
    }
    const delta = curveKeyDelta(event, left, right, meta.step);
    if (delta === null) {
      return;
    }
    event.preventDefault();
    const moved = actions.setCurve(
      index,
      (left.curve ?? 0) + delta,
      Object.assign(createChangeEventDetails("curve", native), { index })
    );
    if (moved) {
      actions.commit(meta.valueRef.current, {
        event: native,
        index,
        reason: "curve",
      });
    }
  };

  const resolved = resolveStyling(className, style, segmentState);
  const midX = from && to ? (from.x + to.x) / 2 : 0;
  const midY =
    from && to ? from.y + (to.y - from.y) * segmentShape(0.5, from.curve) : 0;

  return useRender({
    defaultTagName: "div",
    enabled: Boolean(from && to),
    props: mergeProps<"div">(
      {
        "aria-disabled": state.disabled || flat || undefined,
        "aria-valuemax": 1,
        "aria-valuemin": -1,
        "aria-valuenow": curve,
        "aria-valuetext": getAriaValueText
          ? getAriaValueText(curve, index)
          : String(Math.round(curve * 100) / 100),
        onDoubleClick: handleDoubleClick,
        onFocus: () => actions.setFocusedSegmentIndex(index),
        onKeyDown: handleKeyDown,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        role: "slider",
        tabIndex: state.disabled || index !== meta.focusedSegmentIndex ? -1 : 0,
      },
      {
        ...elementProps,
        className: resolved.className,
        style: {
          bottom: `${midY * 100}%`,
          left: `${midX * 100}%`,
          position: "absolute",
          touchAction: "none",
          transform: "translate(-50%, 50%)",
          ...resolved.style,
        },
      }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
    state: segmentState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Segment {
  export type State = Root.State & {
    /** The bend, from -1 to 1. */
    curve: number;
    /** Whether the segment joins two points of the same level, so there is nothing to bend. */
    flat: boolean;
    index: number;
  };
  export interface Props extends PartProps<"div", State> {
    /** Returns the handle's `aria-valuetext`. Defaults to the curve as a number. */
    getAriaValueText?: (curve: number, index: number) => string;
    /** Index of the point the segment leaves from. */
    index: number;
  }
}
