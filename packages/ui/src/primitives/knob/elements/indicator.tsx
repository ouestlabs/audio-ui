import {
  DEFAULT_ARC_STROKE_WIDTH,
  STATE_ATTRIBUTES_MAPPING,
} from "@audio-ui/core/knob";
import { resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { useKnobContext } from "../context.js";
import { useArcProps } from "../internal/arc-props.js";
import type { Root } from "./root.js";
import type { Track } from "./track.js";

/**
 * The arc from `anchor` to the value, drawn over the `Track`.
 * Renders an `<svg>` element.
 */
export function Indicator(componentProps: Indicator.Props) {
  const {
    className,
    ref,
    render,
    strokeWidth = DEFAULT_ARC_STROKE_WIDTH,
    style,
    ...elementProps
  } = componentProps;
  const { snapshot, state } = useKnobContext("Indicator");
  const from = Math.min(snapshot.anchorPercent, snapshot.percent);
  const to = Math.max(snapshot.anchorPercent, snapshot.percent);
  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(useArcProps(strokeWidth, from, to), {
      ...elementProps,
      ...resolveStyling(className, style, state),
    }),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Indicator {
  export type State = Root.State;
  export type Props = Track.Props;
}
