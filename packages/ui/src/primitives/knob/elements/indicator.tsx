import { resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useKnobContext } from "../context";
import { useArcProps } from "../internal/arc-props";
import {
  DEFAULT_ARC_STROKE_WIDTH,
  STATE_ATTRIBUTES_MAPPING,
} from "../internal/shared";
import type { Root } from "./root";
import type { Track } from "./track";

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
  const { meta, state } = useKnobContext("Indicator");
  const from = Math.min(meta.anchorPercent, meta.percent);
  const to = Math.max(meta.anchorPercent, meta.percent);
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
