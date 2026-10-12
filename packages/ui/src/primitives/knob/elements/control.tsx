import { STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/knob";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useKnobContext } from "../context.ts";
import type { Root } from "./root.tsx";

/**
 * The interactive surface: pointer drags (see `dragMode`), mouse-wheel
 * stepping, and double tap (or Alt + click) to reset. Sets `touch-action: none` so touch drags
 * don't scroll the page. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { controller, inputRef, state } = useKnobContext("Control");

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

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onPointerDown: handlePointerDown,
        style: { touchAction: "none" },
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
