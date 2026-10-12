import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { placedAt, type TimelineState, useTimelineContext } from "../context";

/**
 * Something placed at `value` on a lane: a bar number on the ruler, a cue, a
 * grid line. Its children are its label. Renders a `<div>` element.
 */
export function Mark(componentProps: Mark.Props) {
  const { className, ref, render, style, value, ...elementProps } =
    componentProps;
  const { state } = useTimelineContext("Mark");
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: placedAt(value) },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Mark {
  export type State = TimelineState;
  export interface Props extends PartProps<"div", State> {
    /** Where the mark sits, in the timeline's units. */
    value: number;
  }
}
