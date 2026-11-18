import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";
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

/** The curve through the points: an `<svg>` over the graph, drawn in its `color`. */
const Line = defineComponent(
  (props: { strokeWidth?: number }, { attrs }) =>
    () =>
      h(
        parts.Line,
        { ...attrs, strokeWidth: props.strokeWidth },
        {
          default: ({ state }: { state: ShapeState }) =>
            h("polyline", {
              fill: "none",
              points: state.points,
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": props.strokeWidth ?? DEFAULT_STROKE_WIDTH,
              style: { vectorEffect: "non-scaling-stroke" },
            }),
        }
      ),
  { inheritAttrs: false, name: "EnvelopeLine", props: ["strokeWidth"] }
);

/** The area under the curve: an `<svg>` over the graph, filled with its `color`. */
const Fill = defineComponent(
  (_props, { attrs }) =>
    () =>
      h(parts.Fill, attrs, {
        default: ({ state }: { state: ShapeState }) =>
          h("polyline", {
            fill: "currentColor",
            points: state.points,
            stroke: "none",
          }),
      }),
  { inheritAttrs: false, name: "EnvelopeFill" }
);

/**
 * The points and the segments are written by the app, one for each: the Root's
 * default slot gets its state, whose `value` is the points.
 */
export const Envelope = {
  Fill,
  Graph: parts.Graph,
  Line,
  Point: parts.Point,
  Root: parts.Root,
  Segment: parts.Segment,
};
