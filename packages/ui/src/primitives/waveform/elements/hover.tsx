import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useWaveformContext, type WaveformState } from "../context.ts";

/**
 * Shown while the pointer is over the `Control`, positioned at the hovered
 * point. Its children receive the hovered position, to print a time.
 * Renders a `<div>` element.
 */
export function Hover(componentProps: Hover.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = useWaveformContext("Hover");
  const { hover } = meta;
  const hovered = React.useSyncExternalStore(
    hover.subscribe,
    hover.get,
    hover.get
  );
  const fraction = hovered === null ? 0 : meta.toShare(hovered);
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
