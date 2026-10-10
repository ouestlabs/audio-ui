import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import { type PianoRollState, usePianoRollContext } from "../context";

/**
 * The selection rectangle being dragged across the grid; renders nothing the
 * rest of the time. Hidden from assistive technology. Renders a `<div>`
 * element.
 */
export function Marquee(componentProps: Marquee.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { meta, state } = usePianoRollContext("Marquee");
  const { band } = meta;
  return useRender({
    defaultTagName: "div",
    enabled: band !== null,
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          height: band?.height,
          left: band?.left,
          pointerEvents: "none",
          position: "absolute",
          top: band?.top,
          width: band?.width,
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Marquee {
  export type State = PianoRollState;
  export type Props = PartProps<"div", State>;
}
