import type { PartProps } from "../../internal/part.ts";
import { resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";

const NO_STATE: Track.State = {};

/** The full range of a channel, behind the indicator. Renders a `<div>` element. */
export function Track(componentProps: Track.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      elementProps,
      resolveStyling(className, style, NO_STATE)
    ),
    ref,
    render,
    state: NO_STATE,
  });
}

export namespace Track {
  export type State = Record<string, never>;
  export type Props = PartProps<"div", State>;
}
