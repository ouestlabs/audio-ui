import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import { UNIT_PROPERTY } from "../context";
import { type ClipState, useClipContext } from "./clip-context";

/**
 * Shades the part of the clip a fade attenuates, a triangle from the clip's
 * edge as long as the fade, so the ramp reads over the content. It is empty
 * while its fade is, and ignores the pointer. Style its `fill`.
 * Renders an `<svg>` element.
 */
export function ClipFade(componentProps: ClipFade.Props) {
  const { className, edge, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state: clipState } = useClipContext("ClipFade");
  const length = edge === "in" ? meta.value.fadeIn : meta.value.fadeOut;
  const state = { ...clipState, edge };
  const property = edge === "in" ? "--clip-fade-in" : "--clip-fade-out";

  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        children: (
          <path
            d={edge === "in" ? "M0 0H1L0 1Z" : "M0 0H1V1Z"}
            fill="currentColor"
          />
        ),
        focusable: "false",
        preserveAspectRatio: "none",
        style: {
          bottom: 0,
          display: length > 0 ? undefined : "none",
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          width: `calc(var(${UNIT_PROPERTY}) * var(${property}))`,
          ...(edge === "in" ? { insetInlineStart: 0 } : { insetInlineEnd: 0 }),
        },
        viewBox: "0 0 1 1",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace ClipFade {
  export type State = ClipState & {
    /** The fade this shades. */
    edge: "in" | "out";
  };
  export interface Props extends PartProps<"svg", State> {
    /** The fade of the clip this shades: the one at its start or at its end. */
    edge: "in" | "out";
  }
}
