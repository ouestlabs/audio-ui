import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import { type TrackState, useTrackContext } from "./track-context.js";

/**
 * Sets the track's height: by dragging, or from the keyboard through the
 * native `<input type="range">` it holds, which carries the accessible name:
 * the arrows move by a step (Down is taller), Page Up and Down by a large
 * one, Home and End to the least and the most. Place it along the track's
 * lower edge. A double-click gives the height up, so the track shares the room
 * again. Renders a `<div>` element.
 */
export function TrackResizeHandle(componentProps: TrackResizeHandle.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { controller, meta, state } = useTrackContext("TrackResizeHandle");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // The track's own press (to pick it) is not this one.
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    controller.press(event.nativeEvent, event.currentTarget);
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) =>
      controller.reset(event.nativeEvent),
    [controller]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      controller.typeAt(Number(event.currentTarget.value), event.nativeEvent),
    [controller]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-orientation="vertical"
              max={meta.max}
              min={meta.min}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={meta.height ?? meta.min}
            />
          </>
        ),
        onDoubleClick: handleDoubleClick,
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

export namespace TrackResizeHandle {
  export type State = TrackState;
  export type Props = PartProps<"div", State>;
}
