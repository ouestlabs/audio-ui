import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { degToRad, TAU } from "../../../utils";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { useKnobContext } from "../context";
import {
  CENTER_DEAD_ZONE_MIN_PX,
  CENTER_DEAD_ZONE_REL,
  DOUBLE_TAP_MAX_MS,
  FINE_DRAG,
  pointerAngle,
  STATE_ATTRIBUTES_MAPPING,
  SWEEP_ANGLE,
  TAP_MAX_MOVE_PX,
  VERTICAL_DRAG_RANGE_PX,
} from "../internal/shared";
import type { Root } from "./root";

interface DragGesture {
  /** Whether the gesture changed the value at least once; if so its end commits, even back on the start value. */
  changed: boolean;
  lastAngle: number;
  lastY: number;
  /** Farthest distance from the press point, in px. */
  maxDistance: number;
  pointerId: number;
  /**
   * Where the drag has taken the dial along its travel, 0…1 and beyond:
   * accumulated move by move, so Shift can make any stretch of it finer,
   * and kept apart from the rounded value so small moves add up.
   */
  position: number;
  rect: DOMRect;
  startX: number;
  startY: number;
}

/**
 * The interactive surface: pointer drags (see `dragMode`), mouse-wheel
 * stepping, and double tap to reset. Sets `touch-action: none` so touch drags
 * don't scroll the page. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useKnobContext("Control");
  const gestureRef = React.useRef<DragGesture | null>(null);
  const lastTapAtRef = React.useRef(0);

  const valueFromGesture = (
    gesture: DragGesture,
    event: React.PointerEvent
  ): number => {
    const speed = event.shiftKey ? FINE_DRAG : 1;
    if (meta.dragMode === "vertical") {
      gesture.position +=
        ((gesture.lastY - event.clientY) / VERTICAL_DRAG_RANGE_PX) * speed;
    } else {
      const { rect } = gesture;
      const angle = pointerAngle(event.clientX, event.clientY, rect);
      const distance = Math.hypot(
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2)
      );
      const deadZone = Math.max(
        CENTER_DEAD_ZONE_MIN_PX,
        Math.min(rect.width, rect.height) * CENTER_DEAD_ZONE_REL
      );
      if (distance > deadZone) {
        let delta = angle - gesture.lastAngle;
        if (delta > Math.PI) {
          delta -= TAU;
        } else if (delta < -Math.PI) {
          delta += TAU;
        }
        const fullTurn =
          meta.dragMode === "revolution" ? TAU : degToRad(SWEEP_ANGLE);
        gesture.position += (delta / fullTurn) * speed;
      }
      gesture.lastAngle = angle;
    }
    gesture.lastY = event.clientY;
    return meta.scale.toValue(gesture.position, state.min, state.max);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const control = event.currentTarget;
    control.setPointerCapture?.(event.pointerId);
    meta.inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    const rect = control.getBoundingClientRect();
    gestureRef.current = {
      changed: false,
      lastAngle: pointerAngle(event.clientX, event.clientY, rect),
      lastY: event.clientY,
      maxDistance: 0,
      pointerId: event.pointerId,
      position: meta.scale.toPosition(
        meta.valueRef.current,
        state.min,
        state.max
      ),
      rect,
      startX: event.clientX,
      startY: event.clientY,
    };
    actions.setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      endGesture(event, true);
      return;
    }
    gesture.maxDistance = Math.max(
      gesture.maxDistance,
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY)
    );
    if (
      actions.change(
        valueFromGesture(gesture, event),
        createChangeEventDetails("drag", event.nativeEvent)
      )
    ) {
      gesture.changed = true;
    }
  };

  const endGesture = (
    event: React.PointerEvent<HTMLDivElement>,
    allowTap: boolean
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    actions.setDragging(false);
    const native = event.nativeEvent;

    if (allowTap && gesture.maxDistance <= TAP_MAX_MOVE_PX) {
      const now = performance.now();
      const isDoubleTap = now - lastTapAtRef.current <= DOUBLE_TAP_MAX_MS;
      lastTapAtRef.current = isDoubleTap ? 0 : now;
      if (
        isDoubleTap &&
        actions.change(
          meta.resetValue,
          createChangeEventDetails("reset", native)
        )
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "reset",
        });
      }
      return;
    }
    lastTapAtRef.current = 0;
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, { event: native, reason: "drag" });
    }
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onLostPointerCapture: (event) => endGesture(event, true),
        onPointerCancel: (event) => endGesture(event, false),
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: (event) => endGesture(event, true),
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
