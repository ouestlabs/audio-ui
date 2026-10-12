import { createChangeEventDetails } from "@audio-ui/core";
import { STATE_ATTRIBUTES_MAPPING, steppedValue } from "@audio-ui/core/knob";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { useKnobContext } from "../context";
import type { Root } from "./root";

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
  const { actions, meta, state } = useKnobContext("Thumb");
  const { inputRef } = meta;

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
      if (state.disabled) {
        return;
      }
      const { current } = meta.valueRef;
      const options = {
        largeStep: meta.largeStep,
        max: state.max,
        min: state.min,
        scale: meta.scale,
        step: meta.step,
      };
      const targets: Record<string, number> = {
        ArrowDown: steppedValue(current, -1, event.shiftKey, options),
        ArrowLeft: steppedValue(current, -1, event.shiftKey, options),
        ArrowRight: steppedValue(current, 1, event.shiftKey, options),
        ArrowUp: steppedValue(current, 1, event.shiftKey, options),
        End: state.max,
        Home: state.min,
        PageDown: steppedValue(current, -1, true, options),
        PageUp: steppedValue(current, 1, true, options),
      };
      const native = event.nativeEvent;
      // Delete returns to the default, as in a DAW.
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (
          actions.change(
            meta.resetValue,
            createChangeEventDetails("reset", native)
          )
        ) {
          actions.commit(meta.valueRef.current, {
            event: native,
            reason: "reset",
          });
        }
        return;
      }
      const next = targets[event.key];
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      if (actions.change(next, createChangeEventDetails("keyboard", native))) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "keyboard",
        });
      }
    },
    [actions, meta, state.disabled, state.max, state.min]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      if (
        actions.change(
          Number(event.currentTarget.value),
          createChangeEventDetails("input-change", native)
        )
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, meta]
  );

  const formattedValue = meta.formatter.format(state.value);

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
                ariaLabelledBy ?? (ariaLabel ? undefined : meta.labelId)
              }
              aria-valuetext={
                getAriaValueText
                  ? getAriaValueText(formattedValue, state.value)
                  : formattedValue
              }
              disabled={state.disabled}
              form={meta.form}
              id={meta.inputId}
              max={state.max}
              min={state.min}
              name={meta.name}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={setInputRef}
              step={meta.step}
              style={VISUALLY_HIDDEN}
              type="range"
              value={state.value}
            />
          </>
        ),
        style: { rotate: `${meta.angle}deg` },
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
