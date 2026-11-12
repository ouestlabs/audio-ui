import type { Note, NoteLevel } from "@audio-ui/core/piano-roll";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import { placedAt } from "../../timeline/context.ts";
import { LaneContext, useLaneProps } from "../../timeline/elements/lane.tsx";
import {
  CHANCE_PROPERTY,
  DEVIATION_PROPERTY,
  LEVEL_PROPERTY,
  type PianoRollState,
  usePianoRollContext,
  useRollView,
  VELOCITY_PROPERTY,
} from "../context.ts";

const describeVelocity = (velocity: number) => `${Math.round(velocity * 100)}%`;

/** What the bars of the lane stand for. */
const LevelContext = React.createContext<NoteLevel>("velocity");

/**
 * A strip under the grid where each note's velocity, or with `level="chance"`
 * its chance to play, stands as a bar placed at the note's start: a timeline
 * lane, like the grid. In draw mode it is a brush: a drag across it sets
 * every bar under the pointer, in the grid cell it is over, to the pointer's
 * height. Put a `PianoRoll.Velocity` per note inside, with `PianoRoll.Notes`.
 * Renders a `<div>` element.
 */
export function VelocityLane(componentProps: VelocityLane.Props) {
  const {
    className,
    level = "velocity",
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { controller, state: rollState } = usePianoRollContext("VelocityLane");
  const { lane, laneRef, style: laneStyle } = useLaneProps("Lane");
  // A bar takes its own presses; one on the lane between them paints in draw mode.
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.defaultPrevented) {
      controller.paintLevels(event.nativeEvent, event.currentTarget, level);
    }
  };
  const state = React.useMemo<VelocityLane.State>(
    () => ({ ...rollState, level }),
    [level, rollState]
  );
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { onPointerDown: handlePointerDown, role: "group", style: laneStyle },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, laneRef] : laneRef,
    render,
    state,
  });
  return (
    <LaneContext value={lane}>
      <LevelContext value={level}>{element}</LevelContext>
    </LaneContext>
  );
}

export namespace VelocityLane {
  export type State = PianoRollState & {
    /** What the bars stand for: each note's velocity, or its chance to play. */
    level: NoteLevel;
  };
  export interface Props extends PartProps<"div", State> {
    /** What the bars stand for: each note's velocity, or its chance to play. @default "velocity" */
    level?: NoteLevel;
  }
}

/**
 * One note's velocity, or its chance in a `level="chance"` lane, as a bar from
 * the bottom of the lane: its height is the value, through the
 * `--piano-roll-level` CSS variable. Dragging it up or down changes the value
 * of the selection by the same amount when the note is part of it, so a
 * phrase keeps its dynamics; Shift + click toggles the note in the selection.
 * On a velocity bar, Cmd/Ctrl + drag sets how far the velocity may stray each
 * time the note plays, its `--piano-roll-deviation`. A native
 * `<input type="range">` inside takes the arrow keys (Page Up/Down for larger
 * steps, Home/End for none and full) and carries the accessible name, which
 * defaults to the note's. The next drawn note gets the velocity set last.
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
  const level = React.use(LevelContext);
  const velocity = note[level] ?? 1;
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
      lane.elementRef.current,
      level
    );
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      if (controller.keyVelocity(note.id, event.nativeEvent, level)) {
        event.preventDefault();
      }
    },
    [controller, disabled, level, note.id]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.setVelocity(
        note.id,
        Number(event.currentTarget.value),
        event.nativeEvent,
        level
      );
    },
    [controller, level, note.id]
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
          [LEVEL_PROPERTY as string]: velocity,
          [VELOCITY_PROPERTY as string]: note.velocity ?? 1,
          [CHANCE_PROPERTY as string]: note.chance ?? 1,
          [DEVIATION_PROPERTY as string]: note.deviation ?? 0,
          bottom: 0,
          height: `calc(var(${LEVEL_PROPERTY}) * 100%)`,
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
