import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import {
  type ParameterScaleProp,
  resolveScale,
} from "../../internal/parameter-scale";
import { type PartProps, resolveStyling } from "../../internal/part";
import { PlotContext, type PlotContextValue, type PlotState } from "../context";

/**
 * Groups the parts of a plot and owns its two axes: the range of each and how
 * values spread along it, evenly or logarithmically, the way frequency is
 * drawn. Everything placed on the plot (curves, lines, bands, handles) is
 * placed in the axes' units. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    disabled = false,
    maxX = 1,
    maxY = 1,
    minX = 0,
    minY = 0,
    ref,
    render,
    scaleX = "linear",
    scaleY = "linear",
    style,
    ...elementProps
  } = componentProps;
  const elementRef = React.useRef<HTMLDivElement>(null);

  const state = React.useMemo<Root.State>(() => ({ disabled }), [disabled]);
  const context = React.useMemo<PlotContextValue>(
    () => ({
      meta: {
        elementRef,
        x: { max: maxX, min: minX, scale: resolveScale(scaleX) },
        y: { max: maxY, min: minY, scale: resolveScale(scaleY) },
      },
      state,
    }),
    [maxX, maxY, minX, minY, scaleX, scaleY, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { position: "relative" } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, elementRef] : elementRef,
    render,
    state,
  });

  return <PlotContext value={context}>{element}</PlotContext>;
}

export namespace Root {
  export type State = PlotState;
  export type Scale = ParameterScaleProp;

  export interface Props extends PartProps<"div", State> {
    disabled?: boolean;
    /** @default 1 */
    maxX?: number;
    /** @default 1 */
    maxY?: number;
    /** @default 0 */
    minX?: number;
    /** @default 0 */
    minY?: number;
    /** How x values spread across: `"log"` for frequency, or your own `{ toPosition, toValue }`. @default "linear" */
    scaleX?: Scale;
    /** How y values spread up. @default "linear" */
    scaleY?: Scale;
  }
}
