import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps } from "react";
import { envelope, type ShapeState } from "@/primitives/envelope";

/** Which element each part is. */
const parts = createParts(envelope, {
  fill: "svg",
  graph: "div",
  line: "svg",
  point: "div",
  root: "div",
  segment: "div",
});

const DEFAULT_STROKE_WIDTH = 2;

/**
 * The curve through the points: an `<svg>` over the graph, drawn in its
 * `color`. The stroke is set on the `<svg>`, where a class or a style reaches
 * it, and the line inside takes it from there.
 */
function Line({ strokeWidth, ...props }: ComponentProps<typeof parts.Line>) {
  return (
    <parts.Line
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth ?? DEFAULT_STROKE_WIDTH}
      {...props}
    >
      {({ points }: ShapeState) => (
        <polyline
          fill="inherit"
          points={points}
          stroke="inherit"
          strokeLinecap="inherit"
          strokeLinejoin="inherit"
          strokeWidth="inherit"
          style={{ vectorEffect: "non-scaling-stroke" }}
        />
      )}
    </parts.Line>
  );
}

/** The area under the curve: an `<svg>` over the graph, filled with its `color`, or with the fill its class or style gives it. */
function Fill(props: ComponentProps<typeof parts.Fill>) {
  return (
    <parts.Fill fill="currentColor" stroke="none" {...props}>
      {({ points }: ShapeState) => (
        <polyline fill="inherit" points={points} stroke="inherit" />
      )}
    </parts.Fill>
  );
}

/**
 * The points and the segments are written by the app, one for each: the Root's
 * children can be a function of its state, whose `value` is the points.
 */
export const Envelope = {
  Fill,
  Graph: parts.Graph,
  Line,
  Point: parts.Point,
  Root: parts.Root,
  Segment: parts.Segment,
};
