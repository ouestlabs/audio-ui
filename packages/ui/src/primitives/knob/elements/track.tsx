import {
  DEFAULT_ARC_STROKE_WIDTH,
  STATE_ATTRIBUTES_MAPPING,
} from "@audio-ui/core/knob";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useKnobContext } from "../context.ts";
import { useArcProps } from "../internal/arc-props.tsx";
import type { Root } from "./root.tsx";

/** The full sweep of the dial, as an SVG arc. Renders an `<svg>` element. */
export function Track(componentProps: Track.Props) {
  const {
    className,
    ref,
    render,
    strokeWidth = DEFAULT_ARC_STROKE_WIDTH,
    style,
    ...elementProps
  } = componentProps;
  const { state } = useKnobContext("Track");
  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(useArcProps(strokeWidth, 0, 1), {
      ...elementProps,
      ...resolveStyling(className, style, state),
    }),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Track {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"svg", State>, "strokeWidth"> {
    /** Stroke width in the 48×48 viewBox; the arc stays inside the box. @default 3 */
    strokeWidth?: number;
  }
}
