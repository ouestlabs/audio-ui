import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { RowContext, useSequencerContext } from "../context";
import { isOn } from "../internal/grid";

/**
 * One step of a row: a toggle button, pressed when the step is on. Press it
 * and drag on to paint the same state across the cells you cross; focused,
 * Space or Enter flips it and the arrow keys move to the next cell. Name it
 * with `aria-label`, such as "Kick, step 5". The step being played gets
 * `data-current`. Renders a `<button>` element.
 */
export function Cell(componentProps: Cell.Props) {
  const { className, ref, render, step, style, ...elementProps } =
    componentProps;
  const { actions, meta, state: rootState } = useSequencerContext("Cell");
  const row = React.use(RowContext);
  if (row === null) {
    throw new Error("Sequencer.Cell must be used within Sequencer.Row");
  }
  const cell = { row, step };
  const on = isOn(meta.value, cell);
  const { disabled } = rootState;

  const cellRef = React.useCallback(
    (node: HTMLElement | null) => actions.registerCell({ row, step }, node),
    [actions, row, step]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.parentElement
      ?.closest("[role=group]")
      ?.setPointerCapture?.(event.pointerId);
    actions.focusCell(cell);
    actions.pressCell(cell, event.nativeEvent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      actions.toggleCell(cell, event.nativeEvent);
      return;
    }
    if (actions.moveFocusFrom(cell, event.nativeEvent)) {
      event.preventDefault();
    }
  };

  const state = React.useMemo<Cell.State>(
    () => ({ disabled, on, painting: rootState.painting }),
    [disabled, on, rootState.painting]
  );
  const isTabStop = meta.tabStop.row === row && meta.tabStop.step === step;

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        "aria-pressed": on,
        disabled,
        onFocus: () => actions.setTabStop(cell),
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
        tabIndex: isTabStop ? 0 : -1,
        type: "button",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, cellRef] : cellRef,
    render,
    state,
  });
}

export namespace Cell {
  export type State = {
    disabled: boolean;
    /** Whether the step is on: also `aria-pressed`. */
    on: boolean;
    painting: boolean;
  };
  export interface Props extends PartProps<"button", State> {
    /** Which step this is, from the left. */
    step: number;
  }
}
