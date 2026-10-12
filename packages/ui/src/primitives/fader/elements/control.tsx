import * as React from "react";
import { clamp, roundToStep } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { mergeProps, useRender } from "../../internal/render";
import {
  FADER_STATE_ATTRIBUTES,
  type FaderContextValue,
  useFaderContext,
} from "../context";
import { faderChangeDetails, type Root } from "./root";

/** The value under a point of the control, on the grid of `step`. */
function valueAt(
  control: HTMLElement,
  x: number,
  y: number,
  { max, min, orientation, step }: FaderContextValue
): number {
  const box = control.getBoundingClientRect();
  let share =
    orientation === "vertical"
      ? (box.bottom - y) / (box.height || 1)
      : (x - box.left) / (box.width || 1);
  if (
    orientation === "horizontal" &&
    getComputedStyle(control).direction === "rtl"
  ) {
    share = 1 - share;
  }
  const raw = min + clamp(share, 0, 1) * (max - min);
  return clamp(roundToStep(raw, step, min), min, max);
}

/**
 * The interactive area: a press on the track jumps to the value under it, a
 * press on the thumb drags it from where it was taken, plus mouse-wheel
 * stepping. Sets `touch-action: none` so touch drags don't scroll the page.
 * Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const context = useFaderContext("Control");
  const { disabled, reset, state, wheelRef } = context;
  // Handlers read the latest context: a drag outlives the render it began in.
  const contextRef = React.useRef(context);
  contextRef.current = context;

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const { current } = contextRef;
      if (current.disabled || event.button !== 0) {
        return;
      }
      const control = event.currentTarget;
      const vertical = current.orientation === "vertical";
      const thumb = current.thumbRef.current;
      const onThumb = Boolean(thumb?.contains(event.target as Node));
      // Taken by the thumb, the drag keeps the pointer where it grabbed it.
      let offset = 0;
      if (thumb && onThumb) {
        const box = thumb.getBoundingClientRect();
        offset = vertical
          ? event.clientY - (box.top + box.height / 2)
          : event.clientX - (box.left + box.width / 2);
      }
      event.preventDefault();
      current.inputRef.current?.focus({ preventScroll: true });

      let { value } = current;
      // Whether the interaction set a value, even one it later came back from.
      let changed = false;
      let moved = false;
      const { pointerId } = event;
      if (!onThumb) {
        const next = valueAt(control, event.clientX, event.clientY, current);
        if (
          next !== value &&
          current.change(
            next,
            faderChangeDetails("track-press", event.nativeEvent)
          )
        ) {
          value = next;
          changed = true;
        }
      }
      current.setDragging(true);

      const doc = control.ownerDocument;
      const finish = (end: PointerEvent) => {
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("pointerup", finish);
        doc.removeEventListener("pointercancel", finish);
        contextRef.current.setDragging(false);
        if (changed) {
          contextRef.current.commit(value, {
            event: end,
            reason: moved ? "drag" : "track-press",
          } as Root.CommitEventDetails);
        }
      };
      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) {
          return;
        }
        if (isReleased(moveEvent)) {
          finish(moveEvent);
          return;
        }
        moved = true;
        const next = valueAt(
          control,
          moveEvent.clientX - (vertical ? 0 : offset),
          moveEvent.clientY - (vertical ? offset : 0),
          contextRef.current
        );
        if (
          next !== value &&
          contextRef.current.change(next, faderChangeDetails("drag", moveEvent))
        ) {
          value = next;
          changed = true;
        }
      };
      doc.addEventListener("pointermove", move);
      doc.addEventListener("pointerup", finish);
      doc.addEventListener("pointercancel", finish);
    },
    []
  );

  // A double click, an Alt + click or the Delete key return to the default, as in a DAW.
  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!disabled) {
        reset(event.nativeEvent);
      }
    },
    [disabled, reset]
  );
  const handlePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.altKey && event.button === 0 && !disabled) {
        event.preventDefault();
        event.stopPropagation();
        reset(event.nativeEvent);
      }
    },
    [disabled, reset]
  );
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!disabled && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        reset(event.nativeEvent);
      }
    },
    [disabled, reset]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
        onPointerDownCapture: handlePointerDownCapture,
        style: { touchAction: "none" },
      },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref: [ref, wheelRef] as React.Ref<HTMLDivElement>[],
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });
}

export namespace Control {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
