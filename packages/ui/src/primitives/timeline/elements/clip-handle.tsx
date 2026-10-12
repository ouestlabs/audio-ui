import { createChangeEventDetails } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { clipEnd, trimClipEnd, trimClipStart } from "../clip";
import { snapMove } from "../internal/snap";
import {
  type ClipChangeEventDetails,
  type ClipCommitEventDetails,
  type ClipState,
  keyTargets,
  useClipContext,
  useClipDrag,
} from "./clip-context";

/** Further than any timeline reaches: what an edge is trimmed to to find how far it can go. */
const FAR = Number.MAX_SAFE_INTEGER;

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
  const { actions, meta, state: clipState } = context;
  const { disabled } = clipState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const target = edge === "start" ? "trim-start" : "trim-end";

  const drag = useClipDrag(
    context,
    target,
    !disabled,
    (origin, delta, grid, bounds) => {
      if (edge === "start") {
        return trimClipStart(
          origin,
          snapMove(origin.start + delta, origin.start, grid),
          bounds
        );
      }
      const end = clipEnd(origin);
      return trimClipEnd(origin, snapMove(end + delta, end, grid), bounds);
    }
  );

  const { value, limits } = meta;
  const current = edge === "start" ? value.start : clipEnd(value);
  // How far this edge can go, found by trimming it as far as it goes.
  const min =
    edge === "start"
      ? trimClipStart(value, -FAR, limits).start
      : trimClipEnd(value, -FAR, limits).start +
        trimClipEnd(value, -FAR, limits).length;
  const max =
    edge === "start"
      ? trimClipStart(value, FAR, limits).start
      : clipEnd(trimClipEnd(value, FAR, limits));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.onPointerDown(event);
    if (!disabled && event.button === 0) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  };

  /** Puts this edge at `to`, within its limits. */
  const setEdge = React.useCallback(
    (to: number, reason: "input-change" | "keyboard", native: Event) => {
      const latest = meta.valueRef.current;
      const next =
        edge === "start"
          ? trimClipStart(latest, to, meta.limits)
          : trimClipEnd(latest, to, meta.limits);
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
    [actions, edge, meta.limits, meta.valueRef, target]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      const to = keyTargets(
        current,
        meta.step,
        meta.largeStep,
        event.shiftKey,
        [min, max]
      )[event.key];
      if (to === undefined) {
        return;
      }
      event.preventDefault();
      setEdge(to, "keyboard", event.nativeEvent);
    },
    [current, disabled, max, meta.largeStep, meta.step, min, setEdge]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEdge(
        Number(event.currentTarget.value),
        "input-change",
        event.nativeEvent
      );
    },
    [setEdge]
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
