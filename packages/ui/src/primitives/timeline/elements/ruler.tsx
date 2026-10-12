import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import type {
  DescribePosition,
  SelectionChangeEventDetails,
  SelectionCommitEventDetails,
  TimelineState,
} from "../context.ts";
import { LaneContext, useLaneProps } from "./lane.tsx";

const describeAsNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

/**
 * The lane that moves the position: a press jumps to the pointer and a drag
 * scrubs, both on the grid unless Cmd/Ctrl is held; with Shift held the drag
 * scrubs four times finer. With `onSelectionChange`, a drag that starts with
 * Shift held selects a stretch instead, to loop. It holds the native
 * `<input type="range">` that takes focus, handles the keyboard and carries
 * the accessible name (`aria-label` / `aria-labelledby`). Place
 * `Timeline.Mark`s in it for its labels. Renders a `<div>` element.
 */
export function Ruler(componentProps: Ruler.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText = describeAsNumber,
    onSelectionChange,
    onSelectionCommitted,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { context, lane, laneRef, style: laneStyle } = useLaneProps("Ruler");
  const { controller, meta, state } = context;
  const { duration, position } = meta;
  const elementRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const describeRef = React.useRef(getAriaValueText);
  describeRef.current = getAriaValueText;
  // The selection listeners are the ruler's own: the controller calls them.
  controller.setSelection({ onSelectionChange, onSelectionCommitted });

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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    controller.pressRuler(
      event.nativeEvent,
      event.currentTarget,
      event.currentTarget
    );
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.typeAt(Number(event.currentTarget.value), event.nativeEvent);
    },
    [controller]
  );

  const initialValue = position.get();

  const element = useRender({
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
        onPointerDown: handlePointerDown,
        style: { ...laneStyle, touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, elementRef, laneRef] : [elementRef, laneRef],
    render,
    state,
  });
  return <LaneContext value={lane}>{element}</LaneContext>;
}

export namespace Ruler {
  export type State = TimelineState;
  export interface Props extends PartProps<"div", State> {
    /** Returns how the position is announced, e.g. `"bar 3, beat 2"`. Defaults to the number. */
    getAriaValueText?: DescribePosition;
    /**
     * Fires while a stretch is selected by dragging with Shift held, as
     * `[start, end]` in timeline units on the grid unless Cmd/Ctrl is held:
     * feed it to a `Timeline.Range` as a loop. A plain press and drag still
     * move the position. `eventDetails.cancel()` keeps the selection as it was.
     */
    onSelectionChange?: (
      range: readonly [number, number],
      eventDetails: SelectionChangeEventDetails
    ) => void;
    /** Fires when a selection that changed ends. */
    onSelectionCommitted?: (
      range: readonly [number, number],
      eventDetails: SelectionCommitEventDetails
    ) => void;
  }
}
