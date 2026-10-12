import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { FADER_STATE_ATTRIBUTES, useFaderContext } from "../context.ts";
import type { Root } from "./root.tsx";

/**
 * The interactive area: a press on the track jumps to the value under it, a
 * press on the thumb drags it from where it was taken, plus mouse-wheel
 * stepping. Sets `touch-action: none` so touch drags don't scroll the page.
 * Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { controller, disabled, inputRef, state, thumbRef } =
    useFaderContext("Control");

  const wheelRef = React.useCallback(
    (node: HTMLDivElement | null) =>
      node ? controller.attachWheel(node) : undefined,
    [controller]
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      controller.press(
        event.nativeEvent,
        event.currentTarget,
        thumbRef.current
      );
    },
    [controller, disabled, inputRef, thumbRef]
  );

  // A double click, an Alt + click or the Delete key return to the default, as in a DAW.
  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!disabled) {
        controller.reset(event.nativeEvent);
      }
    },
    [controller, disabled]
  );
  const handlePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.altKey && event.button === 0 && !disabled) {
        event.preventDefault();
        event.stopPropagation();
        controller.reset(event.nativeEvent);
      }
    },
    [controller, disabled]
  );
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!disabled && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        controller.reset(event.nativeEvent);
      }
    },
    [controller, disabled]
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
