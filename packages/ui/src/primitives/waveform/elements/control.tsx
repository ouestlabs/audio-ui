import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import {
  type DescribeValue,
  describeAsPercent,
  type SelectionChangeEventDetails,
  type SelectionCommitEventDetails,
  useWaveformContext,
  type WaveformState,
} from "../context.js";

/**
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * tracks the hovered position for `Waveform.Hover`, sets `touch-action: none`
 * so touch scrubbing doesn't scroll the page, and holds the native
 * `<input type="range">` that takes focus, handles the keyboard and carries
 * the accessible name (`aria-label` / `aria-labelledby`). Leave it out for a
 * waveform that is only shown. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText,
    onSelectionChange,
    onSelectionCommitted,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { controller, meta, state } = useWaveformContext("Control");
  const { duration } = meta;
  // Nothing to seek while disabled, or before the audio is there.
  const inert = state.disabled || state.loading;
  const describe = getAriaValueText ?? describeAsPercent;
  // Kept current for the paints that happen outside React.
  meta.describeRef.current = describe;
  // A Shift + drag selects a stretch: the listeners go to the controller it drags on.
  controller.setSelection({ onSelectionChange, onSelectionCommitted });
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (inert || event.button !== 0) {
      return;
    }
    event.preventDefault();
    meta.inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    controller.pressSeek(event.nativeEvent, event.currentTarget);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (inert) {
      return;
    }
    controller.hoverAt(event.clientX, event.currentTarget);
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

  // Read as it is: the thumb and the input follow the position outside React.
  const initialValue = controller.getSnapshot().value;

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
              aria-valuetext={describe(initialValue, duration)}
              defaultValue={initialValue}
              disabled={state.disabled}
              max={meta.range[1]}
              min={meta.range[0]}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={meta.inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
            />
          </>
        ),
        onPointerDown: handlePointerDown,
        onPointerLeave: () => controller.leave(),
        onPointerMove: handlePointerMove,
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Control {
  export type State = WaveformState;
  export interface Props extends PartProps<"div", State> {
    /** Returns how the position is announced, e.g. `"0:12 of 1:42"`. Defaults to the played share, e.g. `"30%"`. */
    getAriaValueText?: DescribeValue;
    /**
     * Fires while a stretch is selected by dragging with Shift held, as
     * `[start, end]` in `duration` units; feed it to a `Waveform.Region`. A
     * plain press and drag still seek. `eventDetails.cancel()` keeps the
     * selection as it was.
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
