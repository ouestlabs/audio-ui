import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import type { Source } from "../../../source";
import { type PartProps, resolveStyling } from "../../internal/part";
import { type PlotAxis, type PlotState, usePlotContext } from "../context";
import { tracePath } from "../internal/path";

/** A live list of y values, spread evenly across the x axis. */
export type TraceSource = Source<ArrayLike<number>>;

/**
 * A live line across the plot: the list of y values a `source` holds, such as
 * the spectrum of the sound, spread evenly across the x axis. It is drawn
 * straight in the DOM each time the source changes, without re-rendering
 * React, so it can follow audio frame by frame. With `fillTo`, it closes down
 * to that y value to be filled as an area. Sits in `Plot.Graph`.
 * Renders a `<path>` element.
 */
export function Trace(componentProps: Trace.Props) {
  const {
    className,
    fillTo,
    max,
    min,
    ref,
    render,
    source,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = usePlotContext("Trace");
  const nodeRef = React.useRef<SVGPathElement>(null);
  // The values may be on a scale of their own: a spectrum in absolute dB
  // behind an equalizer drawn in dB of gain.
  const y = React.useMemo<PlotAxis>(
    () => ({
      max: max ?? meta.y.max,
      min: min ?? meta.y.min,
      scale: meta.y.scale,
    }),
    [max, meta.y, min]
  );

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    const paint = () => {
      node.setAttribute("d", tracePath(source.getSnapshot(), y, fillTo));
    };
    paint();
    return source.subscribe(paint);
  }, [fillTo, source, y]);

  return useRender({
    defaultTagName: "path",
    props: mergeProps<"path">(
      {
        d: tracePath(source.getSnapshot(), y, fillTo),
        vectorEffect: "non-scaling-stroke",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, nodeRef] : nodeRef,
    render,
    state,
  });
}

export namespace Trace {
  export type State = PlotState;
  export interface Props extends Omit<PartProps<"path", State>, "d"> {
    /** Closes the line to this y value, so it can be filled as an area. */
    fillTo?: number;
    /** Top of the scale the values are on. Defaults to the plot's y axis. */
    max?: number;
    /** Bottom of the scale the values are on. Defaults to the plot's y axis. */
    min?: number;
    /** The live y values; the snapshot may be one array updated in place. */
    source: TraceSource;
  }
}
