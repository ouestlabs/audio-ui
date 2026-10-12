import * as React from "react";
import {
  type ParameterScaleProp,
  resolveScale,
} from "../../internal/parameter-scale";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
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

  const rectRef = React.useRef<DOMRect | null>(null);
  const measure = React.useCallback((fresh = false) => {
    if (fresh || !rectRef.current) {
      const rect = elementRef.current?.getBoundingClientRect();
      rectRef.current = rect && rect.width > 0 && rect.height > 0 ? rect : null;
    }
    return rectRef.current;
  }, []);
  // The box is only good until the plot is resized or the page moves under it.
  React.useEffect(() => {
    const element = elementRef.current;
    const forget = () => {
      rectRef.current = null;
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(forget);
    if (element) {
      observer?.observe(element);
    }
    window.addEventListener("scroll", forget, { capture: true, passive: true });
    window.addEventListener("resize", forget, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", forget, { capture: true });
      window.removeEventListener("resize", forget);
    };
  }, []);

  const state = React.useMemo<Root.State>(() => ({ disabled }), [disabled]);
  const context = React.useMemo<PlotContextValue>(
    () => ({
      meta: {
        elementRef,
        measure,
        x: { max: maxX, min: minX, scale: resolveScale(scaleX) },
        y: { max: maxY, min: minY, scale: resolveScale(scaleY) },
      },
      state,
    }),
    [maxX, maxY, measure, minX, minY, scaleX, scaleY, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      // Layout containment: what moves inside the plot never makes the page
      // around it lay out again.
      { style: { contain: "layout style", position: "relative" } },
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
