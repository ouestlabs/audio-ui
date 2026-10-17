import type { Note } from "@audio-ui/core/piano-roll";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import { placedAt } from "../../timeline/context.ts";
import { LaneContext, useLaneProps } from "../../timeline/elements/lane.tsx";
import {
  type PianoRollState,
  usePianoRollContext,
  useRollView,
  VELOCITY_PROPERTY,
} from "../context.ts";

const describeVelocity = (velocity: number) => `${Math.round(velocity * 100)}%`;

/**
 * A strip under the grid where each note's velocity stands as a bar, placed
 * at the note's start: a timeline lane, like the grid. Put a
 * `PianoRoll.Velocity` per note inside, with `PianoRoll.Notes`.
 * Renders a `<div>` element.
 */
export function VelocityLane(componentProps: VelocityLane.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = usePianoRollContext("VelocityLane");
  const { lane, laneRef, style: laneStyle } = useLaneProps("Lane");
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { role: "group", style: laneStyle },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, laneRef] : laneRef,
    render,
    state,
  });
  return <LaneContext value={lane}>{element}</LaneContext>;
}

export namespace VelocityLane {
  export type State = PianoRollState;
  export type Props = PartProps<"div", State>;
}

/**
 * One note's velocity, as a bar from the bottom of the lane: its height is
 * the velocity, through the `--piano-roll-velocity` CSS variable. Dragging it
 * up or down changes the velocity of the selection by the same amount when
 * the note is part of it, so a phrase keeps its dynamics; Shift + click
 * toggles the note in the selection. A native `<input type="range">` inside
 * takes the arrow keys (Page Up/Down for larger steps, Home/End for silent
 * and full) and carries the accessible name, which defaults to the note's.
 * The next drawn note gets the velocity set last.
 * Renders a `<div>` element.
 */
export function Velocity(componentProps: Velocity.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText = describeVelocity,
    note: noteProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const roll = usePianoRollContext("Velocity");
  const { controller, getNoteLabel, state: rollState } = roll;
  const lane = React.use(LaneContext);
  if (!lane) {
    throw new Error(
      "PianoRoll.Velocity must be used within PianoRoll.VelocityLane"
    );
  }
  const shown = useRollView("Velocity", (view) =>
    view.noteById.get(noteProp.id)
  );
  const note: Note = shown ?? noteProp;
  const velocity = note.velocity ?? 1;
  const { disabled } = rollState;
  const selected = useRollView("Velocity", (view) =>
    view.selection.has(note.id)
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled) {
      return;
    }
    event.preventDefault();
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    controller.pressVelocity(
      note.id,
      event.nativeEvent,
      event.currentTarget,
      lane.elementRef.current
    );
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      if (controller.keyVelocity(note.id, event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller, disabled, note.id]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.setVelocity(
        note.id,
        Number(event.currentTarget.value),
        event.nativeEvent
      );
    },
    [controller, note.id]
  );

  const muted = note.muted ?? false;
  const state = React.useMemo<Velocity.State>(
    () => ({ disabled, muted, selected }),
    [disabled, muted, selected]
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
                ariaLabel ?? (ariaLabelledBy ? undefined : getNoteLabel(note))
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
        style: {
          ...placedAt(note.start),
          [VELOCITY_PROPERTY as string]: velocity,
          bottom: 0,
          height: `calc(var(${VELOCITY_PROPERTY}) * 100%)`,
          touchAction: "none",
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Velocity {
  export type State = {
    disabled: boolean;
    /** Whether the note is deactivated. */
    muted: boolean;
    /** Whether the note is in the selection. */
    selected: boolean;
  };
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode;
    /** Returns how a velocity, 0…1, is announced. Defaults to a percentage. */
    getAriaValueText?: (velocity: number) => string;
    /** The note whose velocity this is. */
    note: Note;
  }
}
