import * as React from "react";
import { clamp, type Point } from "../../../utils";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { mergeProps, useRender } from "../../internal/render";
import { useXYPadContext } from "../context";
import { STATE_ATTRIBUTES_MAPPING } from "../internal/shared";
import type { Root } from "./root";

interface DragGesture {
  /** Whether the gesture changed the value at least once; if so its end commits, even back on the start value. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
  rect: DOMRect;
}

/**
 * The pad surface: a press jumps the value to the pointer and a drag follows
 * it; the mouse wheel / trackpad moves it too. Sets `touch-action: none` so
 * touch drags don't scroll the page. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useXYPadContext("Control");
  const gestureRef = React.useRef<DragGesture | null>(null);

  const valueAt = (gesture: DragGesture, event: React.PointerEvent): Point => {
    const { rect } = gesture;
    const fromLeft = clamp(
      (event.clientX - rect.left) / Math.max(rect.width, 1),
      0,
      1
    );
    const fromBottom = clamp(
      (rect.bottom - event.clientY) / Math.max(rect.height, 1),
      0,
      1
    );
    return {
      x: state.minX + fromLeft * (state.maxX - state.minX),
      y: state.minY + fromBottom * (state.maxY - state.minY),
    };
  };

  const reset = (native: MouseEvent | PointerEvent) => {
    if (
      actions.change(meta.resetValue, createChangeEventDetails("reset", native))
    ) {
      actions.commit(meta.valueRef.current, { event: native, reason: "reset" });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!state.disabled) {
      reset(event.nativeEvent);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    // Alt + click returns to the default, as in a DAW.
    if (event.altKey) {
      reset(event.nativeEvent);
      return;
    }
    const control = event.currentTarget;
    control.setPointerCapture?.(event.pointerId);
    meta.inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    const gesture: DragGesture = {
      changed: false,
      moved: false,
      pointerId: event.pointerId,
      rect: control.getBoundingClientRect(),
    };
    gestureRef.current = gesture;
    actions.setDragging(true);
    gesture.changed = actions.change(
      valueAt(gesture, event),
      createChangeEventDetails("press", event.nativeEvent)
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    gesture.moved = true;
    if (
      actions.change(
        valueAt(gesture, event),
        createChangeEventDetails("drag", event.nativeEvent)
      )
    ) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    actions.setDragging(false);
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, {
        event: event.nativeEvent,
        reason: gesture.moved ? "drag" : "press",
      });
    }
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, meta.wheelRef] : meta.wheelRef,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Control {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
