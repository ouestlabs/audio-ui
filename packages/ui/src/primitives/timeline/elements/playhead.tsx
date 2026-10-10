import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import {
  OFFSET_PROPERTY,
  placedAt,
  type TimelineState,
  useTimelineContext,
} from "../context";

/**
 * A marker at the playback position, on the lane it sits in. It follows the
 * position straight in the DOM, through its own `--timeline-offset` CSS
 * variable, so a playhead moving every frame never re-renders React.
 * Renders a `<div>` element.
 */
export function Playhead(componentProps: Playhead.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { meta, state } = useTimelineContext("Playhead");
  const { position } = meta;
  const nodeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    const follow = () => {
      node.style.setProperty(OFFSET_PROPERTY, String(position.get()));
    };
    follow();
    return position.subscribe(follow);
  }, [position]);

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: placedAt(position.get()),
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, nodeRef] : nodeRef,
    render,
    state,
  });
}

export namespace Playhead {
  export type State = TimelineState;
  export type Props = PartProps<"div", State>;
}
