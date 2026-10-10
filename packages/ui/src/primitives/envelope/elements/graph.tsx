import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import {
  curveForMidpoint,
  levelAt,
  segmentNear,
  snapTo,
} from "../internal/geometry";
import type { Root } from "./root";

interface BendGesture {
  changed: boolean;
  index: number;
  pointerId: number;
  /** Where the segment's midpoint was, and where the pointer was, when the press began. */
  startLevel: number;
  startY: number;
}

/**
 * The drawing surface, a 100×100 stretched viewBox: holds `Line` and `Fill`,
 * and a double click on it adds a point. With Alt held, dragging a segment
 * bends it and a double click straightens it, as in a DAW's automation lane. Carries `data-blocked` briefly when
 * adding is refused at `maxPoints`. Renders an `<svg>` element.
 */
export function Graph(componentProps: Graph.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useEnvelopeContext("Graph");
  const graphState = React.useMemo<Graph.State>(
    () => ({ ...state, blocked: meta.isAddBlocked }),
    [meta.isAddBlocked, state]
  );

  const bendRef = React.useRef<BendGesture | null>(null);

  const pointOf = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      rect,
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
  };

  const change = (
    index: number,
    curve: number,
    native: MouseEvent | PointerEvent
  ) =>
    actions.setCurve(
      index,
      curve,
      Object.assign(createChangeEventDetails("curve", native), { index })
    );

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const at = pointOf(event);
    if (!(at && event.altKey) || state.disabled || event.button !== 0) {
      return;
    }
    const value = meta.valueRef.current;
    const index = segmentNear(value, at.x, at.y);
    const from = value[index ?? 0];
    const to = value[(index ?? 0) + 1];
    if (index === null || !(from && to)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    bendRef.current = {
      changed: false,
      index,
      pointerId: event.pointerId,
      startLevel: levelAt(from, to, 0.5),
      startY: event.clientY,
    };
    actions.setDraggingSegment(index);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const gesture = bendRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const from = meta.valueRef.current[gesture.index];
    const to = meta.valueRef.current[gesture.index + 1];
    if (rect.height <= 0 || !(from && to)) {
      return;
    }
    const level =
      gesture.startLevel + (gesture.startY - event.clientY) / rect.height;
    const curve = curveForMidpoint(from, to, level);
    if (curve !== null && change(gesture.index, curve, event.nativeEvent)) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    const gesture = bendRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    bendRef.current = null;
    actions.setDraggingSegment(null);
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, {
        event: event.nativeEvent,
        index: gesture.index,
        reason: "curve",
      });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const at = pointOf(event);
    if (!at) {
      return;
    }
    if (event.altKey) {
      const index = segmentNear(meta.valueRef.current, at.x, at.y);
      if (index !== null && change(index, 0, event.nativeEvent)) {
        actions.commit(meta.valueRef.current, {
          event: event.nativeEvent,
          index,
          reason: "curve",
        });
      }
      return;
    }
    const free = event.metaKey || event.ctrlKey;
    const step = free ? 0 : meta.snap;
    actions.addPoint(
      { x: snapTo(at.x, step), y: snapTo(at.y, step) },
      event.nativeEvent
    );
  };

  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        onDoubleClick: handleDoubleClick,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        preserveAspectRatio: "none",
        viewBox: "0 0 100 100",
      },
      { ...elementProps, ...resolveStyling(className, style, graphState) }
    ),
    ref: ref ? [ref, meta.graphRef] : meta.graphRef,
    render,
    state: graphState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Graph {
  export type State = Root.State & {
    /** Briefly true after an add was refused at `maxPoints`. */
    blocked: boolean;
  };
  export type Props = PartProps<"svg", State>;
}
