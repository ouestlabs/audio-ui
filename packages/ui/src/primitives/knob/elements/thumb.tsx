import { STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/knob";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import { useKnobContext } from "../context.ts";
import type { Root } from "./root.tsx";

/**
 * Rotates with the value (`rotate`, clockwise from 12 o'clock), so a pointer
 * drawn inside it points at the value. Holds the knob's native
 * `<input type="range">`, which takes focus, carries the accessible name
 * (`aria-label` / `aria-labelledby`) and the form value, and handles the
 * keyboard. Renders a `<div>` element.
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
    ...elementProps
  } = componentProps;
  const {
    controller,
    form,
    inputId,
    inputRef,
    labelId,
    name,
    snapshot,
    state,
  } = useKnobContext("Thumb");

  const setInputRef = React.useCallback(
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

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller]
  );

  // Assistive technology may set the input's value directly.
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      controller.type(Number(event.currentTarget.value), event.nativeEvent),
    [controller]
  );

  const formattedValue = snapshot.formatted;

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
              aria-valuetext={
                getAriaValueText
                  ? getAriaValueText(formattedValue, state.value)
                  : formattedValue
              }
              disabled={state.disabled}
              form={form}
              id={inputId}
              max={state.max}
              min={state.min}
              name={name}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={setInputRef}
              step={snapshot.step}
              style={VISUALLY_HIDDEN}
              type="range"
              value={state.value}
            />
          </>
        ),
        style: { rotate: `${snapshot.angle}deg` },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Thumb {
  export type State = Root.State;
  export interface Props extends PartProps<"div", State> {
    /** Returns the input's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted value. */
    getAriaValueText?: (formattedValue: string, value: number) => string;
    inputRef?: React.Ref<HTMLInputElement>;
  }
}
