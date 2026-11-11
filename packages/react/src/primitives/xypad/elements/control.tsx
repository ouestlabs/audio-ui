import { STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/xypad";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useXYPadContext } from "../context.ts";
import type { Root } from "./root.tsx";

/**
 * The pad surface: a press jumps the value to the pointer and a drag follows
 * it; the mouse wheel / trackpad moves it too. Sets `touch-action: none` so
 * touch drags don't scroll the page. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { controller, inputRef, state } = useXYPadContext("Control");

  const wheelRef = React.useCallback(
    (node: HTMLDivElement | null) =>
      node ? controller.attachWheel(node) : undefined,
    [controller]
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (state.disabled || event.button !== 0) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
      controller.press(event.nativeEvent, event.currentTarget);
    },
    [controller, inputRef, state.disabled]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!state.disabled) {
        controller.reset(event.nativeEvent);
      }
    },
    [controller, state.disabled]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        onPointerDown: handlePointerDown,
        style: { position: "relative", touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, wheelRef] : wheelRef,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Control {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
