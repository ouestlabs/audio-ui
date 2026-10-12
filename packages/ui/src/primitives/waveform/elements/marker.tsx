import { clampFinite } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useWaveformContext, type WaveformState } from "../context";

/**
 * A point of interest on the timeline, such as a cue or a chapter, positioned
 * at `value`. Its children label it. Renders a `<div>` element.
 */
export function Marker(componentProps: Marker.Props) {
  const { className, ref, render, style, value, ...elementProps } =
    componentProps;
  const { meta, state } = useWaveformContext("Marker");
  const { duration } = meta;
  const fraction = meta.toShare(clampFinite(value, 0, duration));
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { left: `${fraction * 100}%`, position: "absolute" } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Marker {
  export type State = WaveformState;
  export interface Props extends PartProps<"div", State> {
    /** Where the marker sits, from 0 to `duration`. */
    value: number;
  }
}
