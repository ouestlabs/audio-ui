import { Slider } from "@base-ui/react/slider";
import * as React from "react";
import { useEditableValue, ValueInput } from "../../internal/editable-value";
import { useFaderContext } from "../context";

/**
 * The formatted value (`format`/`locale` on Root). With `editable`, a double
 * click, or Enter while it has focus, lets you type a value: Enter commits it
 * and Escape drops it. Renders an `<output>` element.
 */
export function Value(componentProps: Value.Props) {
  const { children, editable = false, ref, ...props } = componentProps;
  const { disabled, type, value } = useFaderContext("Value");
  const { editing, finish, readoutProps, readoutRef } = useEditableValue({
    commit: type,
    disabled,
    editable,
  });
  const setRef = React.useCallback(
    (node: HTMLOutputElement | null) => {
      readoutRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [readoutRef, ref]
  );
  const input = (
    <ValueInput
      aria-label={props["aria-label"]}
      finish={finish}
      initial={String(value)}
    />
  );
  return (
    <Slider.Value {...props} {...readoutProps} ref={setRef}>
      {/* biome-ignore lint/suspicious/noLeakedRender: `children` is a node or a function, never a bare number here. */}
      {editing ? () => input : children}
    </Slider.Value>
  );
}

export namespace Value {
  export interface Props extends Slider.Value.Props {
    /** Lets you type a value: a double click, or Enter while it has focus. @default false */
    editable?: boolean;
  }
  export type State = Slider.Value.State;
}
