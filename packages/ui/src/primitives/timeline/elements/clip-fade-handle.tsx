import { createChangeEventDetails } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  nextFadeShape,
  setClipFadeIn,
  setClipFadeOut,
  setClipFadeShape,
} from "../clip";
import { UNIT_PROPERTY } from "../context";
import {
  type ClipChangeEventDetails,
  type ClipCommitEventDetails,
  type ClipState,
  keyTargets,
  useClipContext,
  useClipDrag,
} from "./clip-context";

/**
 * Sets how long one of the clip's fades lasts: by dragging, which is not on
 * the grid, or from the keyboard through the native `<input type="range">` it
 * holds, which carries the accessible name. Double-clicking it, or pressing
 * Enter on its input, steps the fade through its shapes. It sits where its fade ends, from
 * the clip's edge. Renders a `<div>` element.
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
  const { actions, meta, state: clipState } = context;
  const { disabled } = clipState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const target = edge === "in" ? "fade-in" : "fade-out";

  const drag = useClipDrag(context, target, !disabled, (origin, delta) =>
    edge === "in"
      ? setClipFadeIn(origin, origin.fadeIn + delta)
      : setClipFadeOut(origin, origin.fadeOut - delta)
  );

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

  const setFade = React.useCallback(
    (to: number, reason: "input-change" | "keyboard", native: Event) => {
      const latest = meta.valueRef.current;
      const next =
        edge === "in" ? setClipFadeIn(latest, to) : setClipFadeOut(latest, to);
      const eventDetails = Object.assign(
        createChangeEventDetails(reason, native),
        { target }
      ) as ClipChangeEventDetails;
      if (actions.change(next, eventDetails)) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason,
          target,
        } as ClipCommitEventDetails);
      }
    },
    [actions, edge, meta.valueRef, target]
  );

  /** Steps the fade to its next shape. */
  const cycleShape = React.useCallback(
    (reason: "double-click" | "keyboard", native: Event) => {
      const latest = meta.valueRef.current;
      const shape = nextFadeShape(
        edge === "in" ? latest.fadeInShape : latest.fadeOutShape
      );
      const next = setClipFadeShape(latest, edge, shape);
      const eventDetails = Object.assign(
        createChangeEventDetails(reason, native),
        { target }
      ) as ClipChangeEventDetails;
      if (actions.change(next, eventDetails)) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason,
          target,
        } as ClipCommitEventDetails);
      }
    },
    [actions, edge, meta.valueRef, target]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        cycleShape("keyboard", event.nativeEvent);
        return;
      }
      const to = keyTargets(
        current,
        meta.step,
        meta.largeStep,
        event.shiftKey,
        [0, max]
      )[event.key];
      if (to === undefined) {
        return;
      }
      event.preventDefault();
      setFade(to, "keyboard", event.nativeEvent);
    },
    [current, cycleShape, disabled, max, meta.largeStep, meta.step, setFade]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFade(
        Number(event.currentTarget.value),
        "input-change",
        event.nativeEvent
      );
    },
    [setFade]
  );

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      cycleShape("double-click", event.nativeEvent);
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
