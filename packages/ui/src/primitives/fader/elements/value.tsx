import type * as React from "react";
import { useEditableValue, ValueInput } from "../../internal/editable-value.js";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { FADER_STATE_ATTRIBUTES, useFaderContext } from "../context.js";
import type { Root } from "./root.js";

/**
 * The formatted value (`format`/`locale` on Root). With `editable`, a double
 * click, or Enter while it has focus, lets you type a value: Enter commits it
 * and Escape drops it. Renders an `<output>` element.
 */
export function Value(componentProps: Value.Props) {
  const {
    children,
    className,
    editable = false,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { disabled, formatted, inputId, state, type, value } =
    useFaderContext("Value");
  const { editing, finish, readoutProps, readoutRef } = useEditableValue({
    commit: type,
    disabled,
    editable,
  });
  let content: React.ReactNode = formatted;
  if (editing) {
    content = (
      <ValueInput
        aria-label={elementProps["aria-label"]}
        finish={finish}
        initial={String(value)}
      />
    );
  } else if (typeof children === "function") {
    content = children([formatted], [value]);
  } else if (children !== undefined && children !== null) {
    content = children;
  }
  return useRender({
    defaultTagName: "output",
    props: mergeProps<"output">(
      { "aria-live": "off", children: content, htmlFor: inputId },
      elementProps,
      readoutProps,
      resolveStyling(className, style, state)
    ),
    ref: [ref, readoutRef] as React.Ref<HTMLOutputElement>[],
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });
}

export namespace Value {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"output", State>, "children"> {
    /**
     * The readout, or a function of the formatted values and the values
     * (one each: a fader has one thumb). Defaults to the formatted value.
     */
    children?:
      | React.ReactNode
      | ((
          formattedValues: readonly string[],
          values: readonly number[]
        ) => React.ReactNode);
    /** Allows typing a value: double-click, or press Enter while it has focus. @default false */
    editable?: boolean;
  }
}
