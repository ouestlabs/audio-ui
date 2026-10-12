import * as React from "react";
import type { Point as GeomPoint } from "../../../utils";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { mergeProps, useRender } from "../../internal/render";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import { LARGE_STEP_MULTIPLIER, snapTo } from "../internal/geometry";
import type { Root } from "./root";

/** With Shift held a drag moves this share of the pointer's distance. */
const FINE_RATIO = 0.25;

interface PointGesture {
  /** Whether the gesture moved the point at least once; if so its end commits. */
  changed: boolean;
  /** While Shift is held: where the pointer and the point were when it went down, so the point follows a share of the pointer's travel. */
  fine: { pointer: GeomPoint; point: GeomPoint } | null;
  pointerId: number;
}

/**
 * A draggable handle for the point at `index`, positioned with `left`/`bottom`
 * percentages over the `Graph`. It is a `role="slider"` on the point's level
 * (`y`): give it an `aria-label`. One point at a time is the tab stop; arrow
 * keys move it (Shift for larger steps), Delete or a double click removes it.
 * Carries `data-blocked` briefly when removal is refused at `minPoints`.
 * Renders a `<div>` element.
 */
export function Point(componentProps: Point.Props) {
  const {
    className,
    getAriaValueText,
    index,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useEnvelopeContext("Point");
  const point = state.value[index];
  const gestureRef = React.useRef<PointGesture | null>(null);

  const pointState = React.useMemo<Point.State>(
    () => ({
      blocked: meta.blockedIndex === index,
      disabled: state.disabled,
      dragging: meta.draggingIndex === index,
      index,
      removable: state.value.length > meta.minPoints,
      value: state.value,
    }),
    [
      index,
      meta.blockedIndex,
      meta.draggingIndex,
      meta.minPoints,
      state.disabled,
      state.value,
    ]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    // Alt + click removes the point, as in a DAW's automation lane.
    if (event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      actions.removePoint(index, event.nativeEvent);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus({ focusVisible: false, preventScroll: true });
    gestureRef.current = {
      changed: false,
      fine: null,
      pointerId: event.pointerId,
    };
    actions.setFocusedIndex(index);
    actions.setDraggingIndex(index);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const graph = meta.graphRef.current;
    if (!(gesture && graph) || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    const rect = graph.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const pointer = {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
    let target = pointer;
    if (event.shiftKey) {
      gesture.fine ??= {
        point: meta.valueRef.current[index] ?? pointer,
        pointer,
      };
      const { fine } = gesture;
      target = {
        x: fine.point.x + (pointer.x - fine.pointer.x) * FINE_RATIO,
        y: fine.point.y + (pointer.y - fine.pointer.y) * FINE_RATIO,
      };
    } else {
      gesture.fine = null;
      if (meta.snap > 0 && !(event.metaKey || event.ctrlKey)) {
        target = {
          x: snapTo(pointer.x, meta.snap),
          y: snapTo(pointer.y, meta.snap),
        };
      }
    }
    const moved = actions.movePoint(
      index,
      target,
      Object.assign(createChangeEventDetails("drag", event.nativeEvent), {
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
    actions.setDraggingIndex(null);
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, {
        event: event.nativeEvent,
        index,
        reason: "drag",
      });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    actions.removePoint(index, event.nativeEvent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = meta.valueRef.current[index];
    if (state.disabled || !current) {
      return;
    }
    const native = event.nativeEvent;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      actions.removePoint(index, native);
      return;
    }
    const distance = meta.step * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
    const targets: Record<string, GeomPoint> = {
      ArrowDown: { x: current.x, y: current.y - distance },
      ArrowLeft: { x: current.x - distance, y: current.y },
      ArrowRight: { x: current.x + distance, y: current.y },
      ArrowUp: { x: current.x, y: current.y + distance },
    };
    const target = targets[event.key];
    if (!target) {
      return;
    }
    event.preventDefault();
    const moved = actions.movePoint(
      index,
      target,
      Object.assign(createChangeEventDetails("keyboard", native), { index })
    );
    if (moved) {
      actions.commit(meta.valueRef.current, {
        event: native,
        index,
        reason: "keyboard",
      });
    }
  };

  const { registerPoint } = actions;
  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => registerPoint(index, node),
    [index, registerPoint]
  );

  const resolved = resolveStyling(className, style, pointState);
  // Centering stays in `transform` so a feedback animation can use the
  // standalone `translate` property without fighting it.
  const baseTransform = "translate(-50%, 50%)";

  return useRender({
    defaultTagName: "div",
    enabled: Boolean(point),
    props: mergeProps<"div">(
      {
        "aria-disabled": state.disabled || undefined,
        "aria-valuemax": 1,
        "aria-valuemin": 0,
        "aria-valuenow": point?.y,
        "aria-valuetext": point
          ? (getAriaValueText?.(point, index) ??
            meta.formatPoint(point.x, point.y))
          : undefined,
        onDoubleClick: handleDoubleClick,
        onFocus: () => actions.setFocusedIndex(index),
        onKeyDown: handleKeyDown,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        role: "slider",
        tabIndex: state.disabled || index !== meta.focusedIndex ? -1 : 0,
      },
      {
        ...elementProps,
        className: resolved.className,
        style: {
          bottom: `${(point?.y ?? 0) * 100}%`,
          left: `${(point?.x ?? 0) * 100}%`,
          position: "absolute",
          touchAction: "none",
          ...resolved.style,
          transform: resolved.style?.transform
            ? `${baseTransform} ${resolved.style.transform}`
            : baseTransform,
        },
      }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
    state: pointState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Point {
  export type State = Root.State & {
    /** Briefly true after a removal was refused at `minPoints`. */
    blocked: boolean;
    index: number;
    /** Whether the point can currently be removed. */
    removable: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** Returns the point's `aria-valuetext`. Defaults to the formatted `x, y`. */
    getAriaValueText?: (point: GeomPoint, index: number) => string;
    /** Index of the point in the (sorted) value. */
    index: number;
  }
}
