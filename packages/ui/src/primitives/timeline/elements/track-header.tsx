import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import { type TrackState, useTrackContext } from "./track-context";

/**
 * The strip beside a track's lane that names it and holds what sets it. It
 * stays at the left edge while the lane scrolls under it. Renders a `<div>`
 * element.
 */
export function TrackHeader(componentProps: TrackHeader.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useTrackContext("TrackHeader");
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { flexShrink: 0, left: 0, position: "sticky", zIndex: 20 } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace TrackHeader {
  export type State = TrackState;
  export type Props = PartProps<"div", State>;
}
