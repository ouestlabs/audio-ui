import { envelope, type ShapeState } from "@audio-ui/primitives/envelope";
import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps } from "react";

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

/** The curve through the points: an `<svg>` over the graph, drawn in its `color`. */
function Line({ strokeWidth, ...props }: ComponentProps<typeof parts.Line>) {
  const width = strokeWidth ?? DEFAULT_STROKE_WIDTH;
  return (
    <parts.Line {...props} strokeWidth={strokeWidth}>
      {({ points }: ShapeState) => (
        <polyline
          fill="none"
          points={points}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={width}
          style={{ vectorEffect: "non-scaling-stroke" }}
        />
      )}
    </parts.Line>
  );
}

/** The area under the curve: an `<svg>` over the graph, filled with its `color`. */
function Fill(props: ComponentProps<typeof parts.Fill>) {
  return (
    <parts.Fill {...props}>
      {({ points }: ShapeState) => (
        <polyline fill="currentColor" points={points} stroke="none" />
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
