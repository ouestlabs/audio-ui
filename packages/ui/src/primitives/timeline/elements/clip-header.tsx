import type * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { type ClipState, useClipContext, useClipDrag } from "./clip-context.js";

/**
 * The clip's title bar: dragging it moves the clip, on the grid unless
 * Cmd/Ctrl is held, and over other lanes too. The rest of the clip is its
 * body, where a press puts the cursor. Place it along the clip's top and put
 * the clip's name in it. Renders a `<div>` element.
 */
export function ClipHeader(componentProps: ClipHeader.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const context = useClipContext("ClipHeader");
  const { meta, state } = context;

  const drag = useClipDrag(context, "move", meta.movable);

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...drag,
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          drag.onPointerDown(event);
          if (meta.movable && event.button === 0) {
            context.focus();
          }
        },
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace ClipHeader {
  export type State = ClipState;
  export type Props = PartProps<"div", State>;
}
