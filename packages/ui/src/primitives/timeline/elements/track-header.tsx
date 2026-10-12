import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { type TrackState, useTrackContext } from "./track-context";

/**
 * The strip beside a track's lane that names it and holds what sets it. It
 * stays at the left edge while the lane scrolls under it, above the lane's
 * parts at the stacking level of `--timeline-track-header-z` (20): raise it on
 * a header that shows something outside its own row, such as a readout. Renders
 * a `<div>` element.
 */
export function TrackHeader(componentProps: TrackHeader.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useTrackContext("TrackHeader");
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          flexShrink: 0,
          left: 0,
          position: "sticky",
          zIndex: "var(--timeline-track-header-z, 20)",
        },
      },
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
