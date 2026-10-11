import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import { type FadeShape, fadeGain } from "../clip";
import { UNIT_PROPERTY } from "../context";
import { type ClipState, useClipContext } from "./clip-context";

const SAMPLES = 16;

/** The fade's ramp as points in a unit square, from the clip's edge: a fade-in climbs, a fade-out falls. */
function ramp(shape: FadeShape, edge: "in" | "out") {
  const points: string[] = [];
  for (let index = 0; index <= SAMPLES; index += 1) {
    const x = index / SAMPLES;
    const gain = fadeGain(shape, edge === "in" ? x : 1 - x);
    points.push(`${x} ${1 - gain}`);
  }
  return points;
}

/**
 * Draws a fade over the clip's content, as a DAW does: the ramp as a line from
 * the clip's edge, as long as the fade, with what it attenuates lightly
 * shaded. It is hidden while its fade is empty, and ignores the pointer.
 * Its color is the `color` it is given.
 * Renders an `<svg>` element.
 */
export function ClipFade(componentProps: ClipFade.Props) {
  const { className, edge, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state: clipState } = useClipContext("ClipFade");
  const length = edge === "in" ? meta.value.fadeIn : meta.value.fadeOut;
  const shape =
    (edge === "in" ? meta.value.fadeInShape : meta.value.fadeOutShape) ??
    "linear";
  const points = ramp(shape, edge);
  const state = { ...clipState, edge };
  const property = edge === "in" ? "--clip-fade-in" : "--clip-fade-out";

  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        children: (
          <>
            <path
              d={`M0 0H1L${[...points].reverse().join("L")}Z`}
              fill="currentColor"
              fillOpacity={0.2}
            />
            <path
              d={`M${points.join("L")}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </>
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
