import { clamp } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { FADER_STATE_ATTRIBUTES, useFaderContext } from "../context";
import type { Root } from "./root";

/**
 * The draggable thumb, with a nested `<input type="range">` that carries the
 * accessible name (`aria-label`/`aria-labelledby`) and form value.
 * Renders a `<div>` element.
 */
export function Thumb(componentProps: Thumb.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText,
    inputRef: inputRefProp,
    ref,
    render,
    style,
    tabIndex,
    ...elementProps
  } = componentProps;
  const {
    controller,
    disabled,
    formatted,
    inputId,
    inputRef,
    labelId,
    max,
    min,
    name,
    orientation,
    state,
    step,
    thumbRef,
    type,
    value,
  } = useFaderContext("Thumb");
  const vertical = orientation === "vertical";

  // A right-to-left page reverses the horizontal travel and the arrow keys.
  const [rtl, setRtl] = React.useState(false);
  React.useLayoutEffect(() => {
    const node = thumbRef.current;
    if (node) {
      setRtl(getComputedStyle(node).direction === "rtl");
    }
  }, [thumbRef]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent, event.currentTarget)) {
        event.preventDefault();
      }
    },
    [controller]
  );
  const setInput = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof inputRefProp === "function") {
        inputRefProp(node);
      } else if (inputRefProp) {
        inputRefProp.current = node;
      }
    },
    [inputRef, inputRefProp]
  );
  // Assistive technology may set the input's value directly.
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      type(Number(event.currentTarget.value), event.nativeEvent),
    [type]
  );

  const share = clamp(((value - min) / (max - min || 1)) * 100, 0, 100);
  const placement: React.CSSProperties = {
    [vertical ? "bottom" : "insetInlineStart"]: `${share}%`,
    [vertical ? "left" : "top"]: "50%",
    position: "absolute",
    translate: vertical ? "-50% 50%" : `${rtl ? 50 : -50}% -50%`,
    zIndex: state.dragging ? 1 : undefined,
  };

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
              aria-labelledby={
                ariaLabelledBy ?? (ariaLabel ? undefined : labelId)
              }
              aria-orientation={orientation}
              aria-valuetext={
                getAriaValueText?.(formatted, value, 0) ?? formatted
              }
              disabled={disabled}
              id={inputId}
              max={max}
              min={min}
              name={name}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={setInput}
              step={step}
              style={{
                ...VISUALLY_HIDDEN,
                height: "100%",
                width: "100%",
                writingMode: vertical ? "vertical-lr" : undefined,
              }}
              tabIndex={tabIndex}
              type="range"
              value={value}
            />
          </>
        ),
        style: placement,
      },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref: [ref, thumbRef] as React.Ref<HTMLDivElement>[],
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });
}

export namespace Thumb {
  export type State = Root.State;
  export interface Props extends PartProps<"div", State> {
    /** Returns the input's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted value. */
    getAriaValueText?: (
      formattedValue: string,
      value: number,
      index: number
    ) => string;
    /** A ref to the nested `<input type="range">`. */
    inputRef?: React.Ref<HTMLInputElement>;
  }
}
