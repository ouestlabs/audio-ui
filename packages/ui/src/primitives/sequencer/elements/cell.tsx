import { isOn } from "@audio-ui/core/sequencer";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  RowContext,
  useSequencerContext,
  useSequencerView,
} from "../context.ts";

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
  const {
    controller,
    focusCell,
    registerCell,
    rootRef,
    cellNodes,
    state: rootState,
  } = useSequencerContext("Cell");
  const row = React.use(RowContext);
  if (row === null) {
    throw new Error("Sequencer.Cell must be used within Sequencer.Row");
  }
  const cell = React.useMemo(() => ({ row, step }), [row, step]);
  const on = useSequencerView("Cell", (view) => isOn(view.value, cell));
  const isTabStop = useSequencerView(
    "Cell",
    (view) => view.tabStop.row === row && view.tabStop.step === step
  );
  const { disabled } = rootState;

  const cellRef = React.useCallback(
    (node: HTMLElement | null) => registerCell(cell, node),
    [cell, registerCell]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const root = rootRef.current;
    if (disabled || event.button !== 0 || !root) {
      return;
    }
    event.preventDefault();
    root.setPointerCapture?.(event.pointerId);
    controller.setTabStop(cell);
    focusCell(cell);
    controller.pressCell(cell, event.nativeEvent, root, cellNodes);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      controller.toggleCell(cell, event.nativeEvent);
      return;
    }
    const next = controller.moveFocusFrom(cell, event.nativeEvent);
    if (next) {
      event.preventDefault();
      focusCell(next);
    }
  };

  const state = React.useMemo<Cell.State>(
    () => ({ disabled, on }),
    [disabled, on]
  );

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        "aria-pressed": on,
        disabled,
        onFocus: () => controller.setTabStop(cell),
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
  };
  export interface Props extends PartProps<"button", State> {
    /** Which step this is, from the left. */
    step: number;
  }
}
