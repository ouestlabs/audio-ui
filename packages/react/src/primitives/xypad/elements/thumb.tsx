import { type Axis, STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/xypad";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import { useXYPadContext } from "../context.ts";
import type { Root } from "./root.tsx";

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
  const { controller, inputRef, labelId, name, snapshot, state } =
    useXYPadContext("Thumb");

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller]
  );

  const handleChangeX = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      controller.type(
        "x",
        Number(event.currentTarget.value),
        event.nativeEvent
      ),
    [controller]
  );
  const handleChangeY = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      controller.type(
        "y",
        Number(event.currentTarget.value),
        event.nativeEvent
      ),
    [controller]
  );

  const inputProps = (axis: Axis) => {
    const value = state.value[axis];
    const formattedValue = snapshot.formatted[axis];
    let label = getAriaLabel?.(axis);
    if (label === undefined && ariaLabel) {
      label = `${ariaLabel} ${axis.toUpperCase()}`;
    }
    return {
      "aria-describedby": ariaDescribedBy,
      "aria-label": label,
      "aria-labelledby":
        ariaLabelledBy ?? (label === undefined ? labelId : undefined),
      "aria-orientation":
        axis === "x" ? ("horizontal" as const) : ("vertical" as const),
      "aria-valuetext": getAriaValueText
        ? getAriaValueText(formattedValue, value, axis)
        : formattedValue,
      disabled: state.disabled,
      name: name === undefined ? undefined : `${name}.${axis}`,
      max: axis === "x" ? state.maxX : state.maxY,
      min: axis === "x" ? state.minX : state.minY,
      onKeyDown: handleKeyDown,
      step: axis === "x" ? snapshot.stepX : snapshot.stepY,
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
              ref={inputRef}
            />
            <input
              {...inputProps("y")}
              onChange={handleChangeY}
              tabIndex={-1}
            />
          </>
        ),
        style: {
          left: `${snapshot.percentX * 100}%`,
          top: `${100 - snapshot.percentY * 100}%`,
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
