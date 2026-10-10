import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { placedAt } from "../../timeline/context";
import { LaneContext, useLaneProps } from "../../timeline/elements/lane";
import {
  type PianoRollState,
  usePianoRollContext,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
  VELOCITY_PROPERTY,
} from "../context";
import {
  changeVelocity,
  type NoteId,
  type Note as NoteValue,
} from "../internal/edits";

/** What the arrow keys change a velocity by; Page Up/Down move five times as far. */
const VELOCITY_STEP = 0.05;
const VELOCITY_LARGE_STEP = 0.25;

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

interface VelocityGesture {
  changed: boolean;
  /** The lane's height: a drag across all of it goes from silent to full. */
  height: number;
  ids: ReadonlySet<NoteId>;
  origin: NoteValue[];
  pointerId: number;
  startY: number;
}

/**
 * One note's velocity, as a bar from the bottom of the lane: its height is
 * the velocity, through the `--piano-roll-velocity` CSS variable. Dragging it
 * up or down changes the velocity of the selection by the same amount when
 * the note is part of it, so a phrase keeps its dynamics; Shift + click
 * toggles the note in the selection. A native `<input type="range">` inside
 * takes the arrow keys (Page Up/Down for larger steps, Home/End for silent
 * and full) and carries the accessible name, which defaults to the note's.
 * The velocity set last is what the next drawn note gets.
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
  const { actions, meta, state: rollState } = usePianoRollContext("Velocity");
  const lane = React.use(LaneContext);
  if (!lane) {
    throw new Error(
      "PianoRoll.Velocity must be used within PianoRoll.VelocityLane"
    );
  }
  const note = meta.noteById.get(noteProp.id) ?? noteProp;
  const velocity = note.velocity ?? 1;
  const { disabled } = rollState;
  const selected = meta.selection.has(note.id);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const gestureRef = React.useRef<VelocityGesture | null>(null);

  /** The notes an edit acts on: the selection, when this note is part of it. */
  const targets = React.useCallback(() => {
    const selection = meta.selectionRef.current;
    return selection.has(note.id) ? selection : new Set([note.id]);
  }, [meta.selectionRef, note.id]);

  const remember = React.useCallback(() => {
    const latest = meta.valueRef.current.find((other) => other.id === note.id);
    meta.drawTemplateRef.current.velocity = latest?.velocity ?? 1;
  }, [meta.drawTemplateRef, meta.valueRef, note.id]);

  /** Moves the velocity by `delta` from the keyboard or the input, committing at once. */
  const nudge = React.useCallback(
    (delta: number, reason: "input-change" | "keyboard", event: Event) => {
      const next = changeVelocity(meta.valueRef.current, targets(), delta);
      const eventDetails = Object.assign(
        createChangeEventDetails(reason, event),
        { edit: "velocity" as const }
      ) as ValueChangeEventDetails;
      if (actions.change(next, eventDetails)) {
        actions.commit([...meta.valueRef.current], {
          edit: "velocity",
          event,
          reason,
        } as ValueCommitEventDetails);
        remember();
      }
    },
    [actions, meta.valueRef, remember, targets]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled) {
      return;
    }
    event.preventDefault();
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    const selection = meta.selectionRef.current;
    if (event.shiftKey) {
      actions.select(
        selection.has(note.id)
          ? [...selection].filter((id) => id !== note.id)
          : [...selection, note.id],
        createChangeEventDetails("press", event.nativeEvent)
      );
      return;
    }
    let ids = selection;
    if (!selection.has(note.id)) {
      ids = new Set([note.id]);
      actions.select(
        [note.id],
        createChangeEventDetails("press", event.nativeEvent)
      );
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    actions.setEditing(true);
    gestureRef.current = {
      changed: false,
      height: lane.elementRef.current?.getBoundingClientRect().height ?? 0,
      ids,
      origin: [...meta.valueRef.current],
      pointerId: event.pointerId,
      startY: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !gesture.height) {
      return;
    }
    // Up is louder: the bar follows the pointer.
    const delta = (gesture.startY - event.clientY) / gesture.height;
    const next = changeVelocity(gesture.origin, gesture.ids, delta);
    const eventDetails = Object.assign(
      createChangeEventDetails("drag", event.nativeEvent),
      { edit: "velocity" as const }
    );
    if (actions.change(next, eventDetails)) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the notes fall back to the known value after.
    const committed = [...meta.valueRef.current];
    actions.setEditing(false);
    if (gesture.changed) {
      actions.commit(committed, {
        edit: "velocity",
        event: event.nativeEvent,
        reason: "drag",
      });
      remember();
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
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
      nudge(target - velocity, "keyboard", event.nativeEvent);
    },
    [disabled, nudge, velocity]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      nudge(
        Number(event.currentTarget.value) - velocity,
        "input-change",
        event.nativeEvent
      );
    },
    [nudge, velocity]
  );

  const state = React.useMemo<Velocity.State>(
    () => ({ disabled, selected }),
    [disabled, selected]
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
                ariaLabel ??
                (ariaLabelledBy ? undefined : meta.getNoteLabel(note))
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
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
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
    /** Whether the note is in the selection. */
    selected: boolean;
  };
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode;
    /** Returns how a velocity, 0…1, is announced. Defaults to a percentage. */
    getAriaValueText?: (velocity: number) => string;
    /** The note whose velocity this is. */
    note: NoteValue;
  }
}
