import * as React from "react";
import type { Source } from "../../../source";
import type { Point } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import {
  type PlotAxis,
  type PlotState,
  positionOn,
  usePlotContext,
} from "../context";

/** A live point, in the axes' units. */
export type DotSource = Source<Point>;

function placement(point: Point, x: PlotAxis, y: PlotAxis) {
  const left = positionOn(x, point.x);
  const top = 1 - positionOn(y, point.y);
  return {
    left: `${(Number.isNaN(left) ? 0 : left) * 100}%`,
    top: `${(Number.isNaN(top) ? 1 : top) * 100}%`,
  };
}

/**
 * A point on the plot that nothing drags: where the signal is right now, such
 * as the input level on a compressor's curve. Give it a `source` and it moves
 * straight in the DOM without re-rendering React, or a `value` for a still
 * point. Hidden from assistive technology and from the pointer.
 * Renders a `<div>` element.
 */
export function Dot(componentProps: Dot.Props) {
  const { className, ref, render, source, style, value, ...elementProps } =
    componentProps;
  const { meta, state } = usePlotContext("Dot");
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const { x, y } = meta;

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!(node && source)) {
      return;
    }
    const paint = () => {
      const next = placement(source.getSnapshot(), x, y);
      node.style.left = next.left;
      node.style.top = next.top;
    };
    paint();
    return source.subscribe(paint);
  }, [source, x, y]);

  const point = source?.getSnapshot() ?? value ?? { x: x.min, y: y.min };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          ...placement(point, x, y),
          pointerEvents: "none",
          position: "absolute",
          translate: "-50% -50%",
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, nodeRef] : nodeRef,
    render,
    state,
  });
}

export namespace Dot {
  export type State = PlotState;
  export interface Props extends PartProps<"div", State> {
    /** A live point, followed without re-rendering. Takes precedence over `value`. */
    source?: DotSource;
    /** A still point, in the axes' units. */
    value?: Point;
  }
}
