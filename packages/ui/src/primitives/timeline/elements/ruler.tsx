import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  type DescribePosition,
  type TimelineState,
  valueAtPointer,
} from "../context";
import { bypassesGrid, snapToGrid } from "../internal/snap";
import { useLaneProps } from "./lane";

/** Holding Shift scrubs this much slower than the pointer moves. */
const FINE_SCRUB = 0.25;

const describeAsNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

interface ScrubGesture {
  /** Where a fine scrub is measured from: the last point the pointer moved the position at full speed. */
  anchor: { clientX: number; value: number };
  /** Whether the gesture moved the position at least once; if so its end commits. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
}

/**
 * The lane that moves the position: a press jumps to the pointer and a drag
 * scrubs, both on the grid unless Cmd/Ctrl is held; with Shift held the drag
 * scrubs four times finer. It holds the native `<input type="range">` that
 * takes focus, handles the keyboard and carries the accessible name
 * (`aria-label` / `aria-labelledby`). Place `Timeline.Mark`s in it for its
 * labels. Renders a `<div>` element.
 */
export function Ruler(componentProps: Ruler.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText = describeAsNumber,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { context, laneRef, style: laneStyle } = useLaneProps("Ruler");
  const { actions, meta, state } = context;
  const { duration, grid, position, zoom } = meta;
  const elementRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const gestureRef = React.useRef<ScrubGesture | null>(null);
  const describeRef = React.useRef(getAriaValueText);
  describeRef.current = getAriaValueText;

  // The input follows the position outside React, like the playhead.
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const follow = () => {
      const value = position.get();
      const text = describeRef.current(value, duration);
      if (input.getAttribute("aria-valuetext") !== text) {
        input.setAttribute("aria-valuetext", text);
      }
      input.value = String(value);
    };
    follow();
    return position.subscribe(follow);
  }, [duration, position]);

  const valueAt = (event: React.PointerEvent<HTMLDivElement>) =>
    valueAtPointer(event.currentTarget, event.clientX, zoom, duration);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    inputRef.current?.focus({ preventScroll: true });
    const raw = valueAt(event);
    const value = bypassesGrid(event) ? raw : snapToGrid(raw, grid);
    const gesture: ScrubGesture = {
      anchor: { clientX: event.clientX, value },
      changed: false,
      moved: false,
      pointerId: event.pointerId,
    };
    gestureRef.current = gesture;
    actions.setScrubbing(true);
    gesture.changed = actions.seek(
      value,
      createChangeEventDetails("press", event.nativeEvent)
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gesture.moved = true;
    let value: number;
    if (event.shiftKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      const unit = zoom ?? rect.width / Math.max(duration, Number.MIN_VALUE);
      value =
        gesture.anchor.value +
        ((event.clientX - gesture.anchor.clientX) / unit) * FINE_SCRUB;
    } else {
      const raw = valueAt(event);
      value = bypassesGrid(event) ? raw : snapToGrid(raw, grid);
      gesture.anchor = { clientX: event.clientX, value };
    }
    if (
      actions.seek(value, createChangeEventDetails("drag", event.nativeEvent))
    ) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the position falls back to the known value after.
    const committed = position.get();
    actions.setScrubbing(false);
    if (gesture.changed) {
      actions.commitSeek(committed, {
        event: event.nativeEvent,
        reason: gesture.moved ? "drag" : "press",
      });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (state.disabled) {
        return;
      }
      const current = position.get();
      const arrowStep = event.shiftKey ? meta.largeStep : meta.step;
      const targets: Record<string, number> = {
        ArrowDown: current - arrowStep,
        ArrowLeft: current - arrowStep,
        ArrowRight: current + arrowStep,
        ArrowUp: current + arrowStep,
        End: duration,
        Home: 0,
        PageDown: current - meta.largeStep,
        PageUp: current + meta.largeStep,
      };
      const next = targets[event.key];
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      const native = event.nativeEvent;
      if (actions.seek(next, createChangeEventDetails("keyboard", native))) {
        actions.commitSeek(position.get(), {
          event: native,
          reason: "keyboard",
        });
      }
    },
    [actions, duration, meta.largeStep, meta.step, position, state.disabled]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      if (
        actions.seek(
          Number(event.currentTarget.value),
          createChangeEventDetails("input-change", native)
        )
      ) {
        actions.commitSeek(position.get(), {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, position]
  );

  const initialValue = position.get();

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
              aria-valuetext={getAriaValueText(initialValue, duration)}
              defaultValue={initialValue}
              disabled={state.disabled}
              max={duration}
              min={0}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
            />
          </>
        ),
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        style: { ...laneStyle, touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, elementRef, laneRef] : [elementRef, laneRef],
    render,
    state,
  });
}

export namespace Ruler {
  export type State = TimelineState;
  export interface Props extends PartProps<"div", State> {
    /** Returns how the position is announced, e.g. `"bar 3, beat 2"`. Defaults to the number. */
    getAriaValueText?: DescribePosition;
  }
}
