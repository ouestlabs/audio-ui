import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useWaveformContext, type WaveformState } from "../context";

/**
 * Shown while the pointer is over the `Control`, positioned at the hovered
 * point. Its children receive the hovered position, to print a time.
 * Renders a `<div>` element.
 */
export function Hover(componentProps: Hover.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = useWaveformContext("Hover");
  const { duration, hover } = meta;
  const hovered = React.useSyncExternalStore(
    hover.subscribe,
    hover.get,
    hover.get
  );
  const fraction = hovered !== null && duration > 0 ? hovered / duration : 0;
  return useRender({
    defaultTagName: "div",
    enabled: hovered !== null && !(state.disabled || state.loading),
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        children:
          typeof children === "function" ? children(hovered ?? 0) : children,
        style: { left: `${fraction * 100}%`, position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Hover {
  export type State = WaveformState;
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode | ((value: number) => React.ReactNode);
  }
}
