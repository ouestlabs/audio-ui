import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import {
  POSITION_PROPERTY,
  useWaveformContext,
  type WaveformState,
} from "../context.js";

/**
 * A handle centered on the playback position. Renders a `<div>` element.
 */
export function Thumb(componentProps: Thumb.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useWaveformContext("Thumb");
  const resolved = resolveStyling(className, style, state);
  // Centering stays in `transform` so `translate` remains free for styling.
  const baseTransform = "translateX(-50%)";
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { "aria-hidden": true },
      {
        ...elementProps,
        className: resolved.className,
        style: {
          left: `var(${POSITION_PROPERTY})`,
          position: "absolute",
          ...resolved.style,
          transform: resolved.style?.transform
            ? `${baseTransform} ${resolved.style.transform}`
            : baseTransform,
        },
      }
    ),
    ref,
    render,
    state,
  });
}

export namespace Thumb {
  export type State = WaveformState;
  export type Props = PartProps<"div", State>;
}
