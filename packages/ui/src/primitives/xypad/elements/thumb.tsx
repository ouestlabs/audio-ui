import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import type { Point } from "../../../utils";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { useXYPadContext } from "../context";
import {
  type Axis,
  LARGE_STEP_MULTIPLIER,
  STATE_ATTRIBUTES_MAPPING,
} from "../internal/shared";
import type { Root } from "./root";

/**
 * Marks the value on the pad (`left`/`top` as percentages, centered with
 * `translate`). Holds two native `<input type="range">`s, one per axis: the X
 * input takes focus, both carry the accessible name, and the arrow keys move
 * both axes. Renders a `<div>` element.
 */
export function Thumb(componentProps: Thumb.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaLabel,
    getAriaValueText,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useXYPadContext("Thumb");

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (state.disabled) {
        return;
      }
      const { current } = meta.valueRef;
      const multiplier = event.shiftKey ? LARGE_STEP_MULTIPLIER : 1;
      const dx = meta.stepX * multiplier;
      const dy = meta.stepY * multiplier;
      const largeDy = meta.stepY * LARGE_STEP_MULTIPLIER;
      const targets: Record<string, Point> = {
        ArrowDown: { x: current.x, y: current.y - dy },
        ArrowLeft: { x: current.x - dx, y: current.y },
        ArrowRight: { x: current.x + dx, y: current.y },
        ArrowUp: { x: current.x, y: current.y + dy },
        End: { x: state.maxX, y: current.y },
        Home: { x: state.minX, y: current.y },
        PageDown: { x: current.x, y: current.y - largeDy },
        PageUp: { x: current.x, y: current.y + largeDy },
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
      if (!next) {
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
    [actions, meta, state.disabled, state.maxX, state.minX]
  );

  const handleChange = React.useCallback(
    (axis: Axis, event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      const next = {
        ...meta.valueRef.current,
        [axis]: Number(event.currentTarget.value),
      };
      if (
        actions.change(next, createChangeEventDetails("input-change", native))
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, meta]
  );
  const handleChangeX = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => handleChange("x", event),
    [handleChange]
  );
  const handleChangeY = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => handleChange("y", event),
    [handleChange]
  );

  const inputProps = (axis: Axis) => {
    const value = state.value[axis];
    const formattedValue = meta.formatter.format(value);
    let label = getAriaLabel?.(axis);
    if (label === undefined && ariaLabel) {
      label = `${ariaLabel} ${axis.toUpperCase()}`;
    }
    return {
      "aria-describedby": ariaDescribedBy,
      "aria-label": label,
      "aria-labelledby":
        ariaLabelledBy ?? (label === undefined ? meta.labelId : undefined),
      "aria-orientation":
        axis === "x" ? ("horizontal" as const) : ("vertical" as const),
      "aria-valuetext": getAriaValueText
        ? getAriaValueText(formattedValue, value, axis)
        : formattedValue,
      disabled: state.disabled,
      max: axis === "x" ? state.maxX : state.maxY,
      min: axis === "x" ? state.minX : state.minY,
      onKeyDown: handleKeyDown,
      step: axis === "x" ? meta.stepX : meta.stepY,
      style: VISUALLY_HIDDEN,
      type: "range",
      value,
    };
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              {...inputProps("x")}
              onChange={handleChangeX}
              ref={meta.inputRef}
            />
            <input
              {...inputProps("y")}
              onChange={handleChangeY}
              tabIndex={-1}
            />
          </>
        ),
        style: {
          left: `${meta.percentX * 100}%`,
          top: `${100 - meta.percentY * 100}%`,
          translate: "-50% -50%",
        },
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
    /** Names each axis input. Defaults to `aria-label` followed by "X" / "Y". */
    getAriaLabel?: (axis: Axis) => string;
    /** Returns an axis input's `aria-valuetext`. Defaults to the formatted value. */
    getAriaValueText?: (
      formattedValue: string,
      value: number,
      axis: Axis
    ) => string;
  }
}
