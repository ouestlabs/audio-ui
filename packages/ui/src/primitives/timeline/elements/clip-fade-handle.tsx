import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import { UNIT_PROPERTY } from "../context.js";
import {
  type ClipState,
  type ClipTarget,
  useClipContext,
  useClipDrag,
} from "./clip-context.js";

/**
 * Sets how long one of the clip's fades lasts: by dragging, which is not on
 * the grid, or from the keyboard through the native `<input type="range">` it
 * holds, which carries the accessible name. Double-clicking it, or pressing
 * Enter on its input, steps the fade through its shapes. It sits where its
 * fade ends, from the clip's edge. Renders a `<div>` element.
 */
export function ClipFadeHandle(componentProps: ClipFadeHandle.Props) {
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
  const context = useClipContext("ClipFadeHandle");
  const { controller, meta, state: clipState } = context;
  const { disabled } = clipState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const target: ClipTarget = edge === "in" ? "fade-in" : "fade-out";

  const drag = useClipDrag(context, target, !disabled);

  const { value } = meta;
  const current = edge === "in" ? value.fadeIn : value.fadeOut;
  const max = Math.max(
    0,
    value.length - (edge === "in" ? value.fadeOut : value.fadeIn)
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.onPointerDown(event);
    if (!disabled && event.button === 0) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      // Enter steps the shape, as it does on the handle's double click.
      if (event.key === "Enter") {
        event.preventDefault();
        controller.cycleFadeShape(edge, "keyboard", event.nativeEvent);
        return;
      }
      if (controller.edgeKeyDown(target, event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller, disabled, edge, target]
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

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      controller.cycleFadeShape(edge, "double-click", event.nativeEvent);
    }
  };

  const state = React.useMemo<ClipFadeHandle.State>(
    () => ({ ...clipState, edge }),
    [clipState, edge]
  );

  const place: React.CSSProperties =
    edge === "in"
      ? {
          insetInlineStart: `calc(var(${UNIT_PROPERTY}) * var(--clip-fade-in))`,
        }
      : {
          insetInlineEnd: `calc(var(${UNIT_PROPERTY}) * var(--clip-fade-out))`,
        };

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
              min={0}
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
        onDoubleClick: handleDoubleClick,
        onPointerDown: handlePointerDown,
        style: { ...place, position: "absolute", touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace ClipFadeHandle {
  export type State = ClipState & {
    /** The fade this handle sets. */
    edge: "in" | "out";
  };
  export interface Props extends PartProps<"div", State> {
    /** The fade of the clip this handle sets: the one at its start or at its end. */
    edge: "in" | "out";
  }
}
