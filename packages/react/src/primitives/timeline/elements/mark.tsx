import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "@audio-ui/core";
import {
  createRangeController,
  type RangeOptions,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  placedAt,
  type TimelineState,
  useTimelineContext,
  useTimelineState,
} from "../context.ts";
import { LaneContext } from "./lane.tsx";

/** How far a press can wander, in px, and still be a press and not a drag. */
const PRESS_SLOP_PX = 3;

/** Whether an event went to a field you type in, where the arrows and a press are the field's own. */
function inField(target: EventTarget) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** The mark as it is drawn, at `value`; a moving one says when it is `dragging`. */
function PlacedMark(componentProps: Mark.Props & { dragging?: boolean }) {
  const {
    className,
    dragging = false,
    onValueChange: _onValueChange,
    onValueCommitted: _onValueCommitted,
    ref,
    render,
    step: _step,
    style,
    value,
    ...elementProps
  } = componentProps;
  // The state alone: a zoom moves the mark by itself, through the lane's unit, and does not draw it again.
  const rootState = useTimelineState("Mark");
  const state = React.useMemo<Mark.State>(
    () => ({ ...rootState, dragging }),
    [rootState, dragging]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: placedAt(value) },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

function MovingMark(componentProps: Mark.Props) {
  const {
    onValueChange,
    onValueCommitted,
    step: stepProp,
    value,
  } = componentProps;
  const { meta: root, state: rootState } = useTimelineContext("Mark");
  const lane = React.use(LaneContext);
  if (!lane) {
    throw new Error(
      "A moving Timeline.Mark must be used within a Timeline lane"
    );
  }
  // Where the press began, and whether it became a drag, which then keeps its click.
  const press = React.useRef<{ moved: boolean; x: number }>({
    moved: false,
    x: 0,
  });

  const options: RangeOptions = {
    disabled: rootState.disabled,
    duration: root.duration,
    grid: root.grid,
    largeStep: root.largeStep,
    minLength: 0,
    movable: true,
    onValueChange: (range, details) => {
      if (details.reason === "drag" && !press.current.moved) {
        if (Math.abs(details.event.clientX - press.current.x) < PRESS_SLOP_PX) {
          details.cancel();
          return;
        }
        press.current.moved = true;
      }
      onValueChange?.(range[0], details as Mark.ChangeEventDetails);
    },
    onValueCommitted: (range, details) => {
      onValueCommitted?.(range[0], details as Mark.CommitEventDetails);
    },
    step: stepProp ?? root.step,
    value: [value, value],
    zoom: root.zoom,
  };
  const [controller] = React.useState(() => createRangeController(options));
  // Set on every render, so the mark always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  return (
    <PlacedMark
      {...mergeProps<"div">(
        {
          onClickCapture: (event) => {
            if (press.current.moved) {
              press.current.moved = false;
              event.preventDefault();
              event.stopPropagation();
            }
          },
          onKeyDown: (event) => {
            if (
              (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
              !(event.altKey || event.ctrlKey || event.metaKey) &&
              !inField(event.target) &&
              controller.keyDown(event.nativeEvent)
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
          onPointerDown: (event) => {
            if (event.button !== 0 || inField(event.target)) {
              return;
            }
            // The press stops here, so the lane underneath doesn't take it.
            event.stopPropagation();
            press.current = { moved: false, x: event.clientX };
            // Held by what was pressed, so a press that stays one still clicks it.
            controller.press(
              "both",
              event.nativeEvent,
              event.target as Element,
              lane.elementRef.current
            );
          },
        },
        componentProps as React.ComponentProps<"div">
      )}
      dragging={snapshot.dragging}
      value={snapshot.value[0]}
    />
  );
}

/**
 * Something placed at `value` on a lane: a bar number on the ruler, a cue, a
 * grid line. Its children are its label. With `onValueChange` or
 * `onValueCommitted` it moves: a drag takes it along the lane, on the grid
 * unless Cmd/Ctrl is held, landing on a `snapPoints` place within a few px, and
 * Left and Right on something focused inside it move it by `step`. A press
 * that stays one keeps its click; a drag does not click.
 * Renders a `<div>` element.
 */
export function Mark(componentProps: Mark.Props) {
  const { onValueChange, onValueCommitted } = componentProps;
  return onValueChange || onValueCommitted ? (
    <MovingMark {...componentProps} />
  ) : (
    <PlacedMark {...componentProps} />
  );
}

export namespace Mark {
  export type State = TimelineState & {
    /** Whether a pointer is moving the mark. */
    dragging: boolean;
  };
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | ExtraChangeEventDetails<"drag", PointerEvent>
    | ExtraChangeEventDetails<"keyboard", KeyboardEvent>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>;
  export interface Props extends PartProps<"div", State> {
    /** Fires as the mark moves, on each step of a drag and each arrow key. With it or `onValueCommitted`, the mark can be moved. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires once a drag or an arrow key has moved it, with where it landed. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** How far Left and Right move it. Defaults to the timeline's `step`. */
    step?: number;
    /** Where the mark sits, in the timeline's units. */
    value: number;
  }
}
