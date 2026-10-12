import { clipEnd } from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import {
  type ClipState,
  type ClipTarget,
  useClipContext,
  useClipDrag,
} from "./clip-context.js";

/**
 * Trims one edge of the clip: by dragging, on the grid unless Cmd/Ctrl is
 * held, or from the keyboard through the native `<input type="range">` it
 * holds, which carries the accessible name. Trimming the start moves where in
 * the source the clip begins and leaves its content where it is; trimming the
 * end stops where the source or the timeline does. Renders a `<div>` element.
 */
export function ClipHandle(componentProps: ClipHandle.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    edge,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const context = useClipContext("ClipHandle");
  const { controller, meta, state: clipState } = context;
  const { disabled } = clipState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const target: ClipTarget = edge === "start" ? "trim-start" : "trim-end";

  const drag = useClipDrag(context, target, !disabled);

  const { value } = meta;
  const current = edge === "start" ? value.start : clipEnd(value);
  // How far this edge can go, found by trimming it as far as it goes.
  const [min, max] = controller.edgeRange(target);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.onPointerDown(event);
    if (!disabled && event.button === 0) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.edgeKeyDown(target, event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller, target]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.edgeTypeAt(
        target,
        Number(event.currentTarget.value),
        event.nativeEvent
      );
    },
    [controller, target]
  );

  const state = React.useMemo<ClipHandle.State>(
    () => ({ ...clipState, edge }),
    [clipState, edge]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...drag,
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={meta.describe(current, meta.duration)}
              disabled={disabled}
              max={max}
              min={min}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={current}
            />
          </>
        ),
        onPointerDown: handlePointerDown,
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace ClipHandle {
  export type State = ClipState & {
    /** The edge this handle trims. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the clip this handle trims. */
    edge: "end" | "start";
  }
}
