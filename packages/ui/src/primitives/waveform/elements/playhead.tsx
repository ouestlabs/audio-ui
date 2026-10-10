import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import {
  POSITION_PROPERTY,
  useWaveformContext,
  type WaveformState,
} from "../context";

/**
 * A marker at the playback position, with no interaction of its own.
 * Renders a `<div>` element.
 */
export function Playhead(componentProps: Playhead.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useWaveformContext("Playhead");
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: { left: `var(${POSITION_PROPERTY})`, position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Playhead {
  export type State = WaveformState;
  export type Props = PartProps<"div", State>;
}
