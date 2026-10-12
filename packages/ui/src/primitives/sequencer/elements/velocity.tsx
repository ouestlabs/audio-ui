import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { RowContext, useSequencerContext, useSequencerView } from "../context";
import { DEFAULT_VELOCITY, isOn, velocityAt } from "../internal/grid";

/** What the arrow keys change a velocity by; Page Up/Down move five times as far. */
const VELOCITY_STEP = 0.05;
const VELOCITY_LARGE_STEP = 0.25;

/** The CSS variable carrying the velocity, 0…1, for the bar's height. */
export const VELOCITY_PROPERTY = "--sequencer-velocity";

const describeVelocity = (velocity: number) => `${Math.round(velocity * 100)}%`;

/**
 * How loud one step plays, as a bar from the bottom of its box: the height is
 * the velocity, through the `--sequencer-velocity` CSS variable. Pressing it
 * sets the velocity where the pointer is, and dragging on draws across the
 * steps of the row, as in the velocity lane of a drum machine. Alt + click or
 * Delete brings it back to full. A native `<input type="range">` inside takes
 * the arrow keys (Page Up/Down for larger steps, Home/End for silent and full)
 * and carries the accessible name. Put one per step of a `Sequencer.Row`, in
 * a row of its own under the cells. Renders a `<div>` element.
 */
export function Velocity(componentProps: Velocity.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText = describeVelocity,
    ref,
    render,
    step,
    style,
    ...elementProps
  } = componentProps;
  const { actions, state: rootState } = useSequencerContext("Velocity");
  const row = React.use(RowContext);
  if (row === null) {
    throw new Error("Sequencer.Velocity must be used within Sequencer.Row");
  }
  const cell = React.useMemo(() => ({ row, step }), [row, step]);
  const velocity = useSequencerView("Velocity", (view) =>
    velocityAt(view.velocities, cell)
  );
  const on = useSequencerView("Velocity", (view) => isOn(view.value, cell));
  const { disabled } = rootState;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const nodeRef = React.useCallback(
    (node: HTMLElement | null) => actions.registerVelocity({ row, step }, node),
    [actions, row, step]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    if (event.altKey) {
      actions.nudgeVelocity(
        cell,
        DEFAULT_VELOCITY,
        createChangeEventDetails("reset", event.nativeEvent)
      );
      return;
    }
    event.currentTarget.parentElement
      ?.closest("[role=group]")
      ?.setPointerCapture?.(event.pointerId);
    actions.pressVelocity(cell, event.nativeEvent);
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        actions.nudgeVelocity(
          cell,
          DEFAULT_VELOCITY,
          createChangeEventDetails("reset", event.nativeEvent)
        );
        return;
      }
      const target = {
        ArrowDown: velocity - VELOCITY_STEP,
        ArrowLeft: velocity - VELOCITY_STEP,
        ArrowRight: velocity + VELOCITY_STEP,
        ArrowUp: velocity + VELOCITY_STEP,
        End: 1,
        Home: 0,
        PageDown: velocity - VELOCITY_LARGE_STEP,
        PageUp: velocity + VELOCITY_LARGE_STEP,
      }[event.key];
      if (target === undefined) {
        return;
      }
      event.preventDefault();
      actions.nudgeVelocity(
        cell,
        target,
        createChangeEventDetails("keyboard", event.nativeEvent)
      );
    },
    [actions, cell, disabled, velocity]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      actions.nudgeVelocity(
        cell,
        Number(event.currentTarget.value),
        createChangeEventDetails("input-change", event.nativeEvent)
      );
    },
    [actions, cell]
  );

  const state = React.useMemo<Velocity.State>(
    () => ({ disabled, on }),
    [disabled, on]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={
                ariaLabel ?? (ariaLabelledBy ? undefined : `Step ${step + 1}`)
              }
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={getAriaValueText(velocity)}
              disabled={disabled}
              max={1}
              min={0}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={velocity}
            />
          </>
        ),
        onPointerDown: handlePointerDown,
        style: { [VELOCITY_PROPERTY as string]: velocity, touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, nodeRef] : nodeRef,
    render,
    state,
  });
}

export namespace Velocity {
  export type State = {
    disabled: boolean;
    /** Whether the step is on. */
    on: boolean;
  };
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode;
    /** Returns how a velocity, 0…1, is announced. Defaults to a percentage. */
    getAriaValueText?: (velocity: number) => string;
    /** Which step this is, from the left. */
    step: number;
  }
}
