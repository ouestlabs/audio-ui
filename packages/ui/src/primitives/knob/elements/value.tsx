import { STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/knob";
import type * as React from "react";
import { useEditableValue, ValueInput } from "../../internal/editable-value.js";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { useKnobContext } from "../context.js";
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
  const { controller, inputId, snapshot, state } = useKnobContext("Value");
  const formattedValue = snapshot.formatted;
  const { editing, finish, readoutProps, readoutRef } = useEditableValue({
    commit: (typed, event) => controller.type(typed, event),
    disabled: state.disabled,
    editable,
  });
  let content: React.ReactNode =
    typeof children === "function"
      ? children(formattedValue, state.value)
      : (children ?? formattedValue);
  if (editing) {
    content = (
      <ValueInput
        aria-label={elementProps["aria-label"]}
        finish={finish}
        initial={String(state.value)}
      />
    );
  }
  return useRender({
    defaultTagName: "output",
    props: mergeProps<"output">(
      {
        "aria-live": "off",
        children: content,
        htmlFor: inputId,
        ...readoutProps,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, readoutRef] : readoutRef,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Value {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"output", State>, "children"> {
    children?:
      | React.ReactNode
      | ((formattedValue: string, value: number) => React.ReactNode);
    /** Lets you type a value: a double click, or Enter while it has focus. @default false */
    editable?: boolean;
  }
}
