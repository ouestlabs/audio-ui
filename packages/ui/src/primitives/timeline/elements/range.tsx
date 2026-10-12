import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
  isReleased,
  normalizeRange,
  type RangeEdge,
  type RangeValue,
} from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  type DescribePosition,
  placedOver,
  useTimelineContext,
  valueAtPointer,
} from "../context";
import { bypassesGrid, snapRangeMove, snapToGrid } from "../internal/snap";
import { LaneContext } from "./lane";

type WithEdge<Details> = Details & {
  /** What moved: one edge, or the whole range with `"both"`. */
  edge: RangeEdge;
};

const describeNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

interface RangeContextValue {
  actions: {
    /** Propose a range; returns whether it was applied. */
    change: (
      next: RangeValue,
      eventDetails: Range.ChangeEventDetails
    ) => boolean;
    commit: (value: RangeValue, eventDetails: Range.CommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
    /** The timeline's units covered by one px of the lane. */
    unitsPerPixel: () => number;
  };
  meta: {
    describe: DescribePosition;
    duration: number;
    grid: { offset: number; step: number };
    largeStep: number;
    minLength: number;
    step: number;
    /** The range as displayed. */
    value: RangeValue;
    /** Latest displayed range, readable from event handlers. */
    valueRef: React.RefObject<RangeValue>;
  };
  state: Range.State;
}

const RangeContext = React.createContext<RangeContextValue | null>(null);

interface DragGesture {
  /** Whether the gesture changed the range at least once; if so its end commits. */
  changed: boolean;
  /** The range when the pointer went down: the drag is measured from it. */
  origin: RangeValue;
  pointerId: number;
  startX: number;
}

/**
 * Pointer handlers that drag `edge` of the range, on the grid unless Cmd/Ctrl
 * is held. The press stops here, so the lane underneath doesn't take it.
 */
function useRangeDrag(
  context: RangeContextValue,
  edge: RangeEdge,
  enabled: boolean
) {
  const { actions, meta } = context;
  const gestureRef = React.useRef<DragGesture | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (!enabled) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = {
      changed: false,
      origin: meta.valueRef.current,
      pointerId: event.pointerId,
      startX: event.clientX,
    };
    actions.setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      onPointerEnd(event);
      return;
    }
    event.stopPropagation();
    const delta = (event.clientX - gesture.startX) * actions.unitsPerPixel();
    const grid = bypassesGrid(event) ? { offset: 0, step: 0 } : meta.grid;
    const next = snapRangeMove(gesture.origin, edge, delta, meta, grid);
    const eventDetails = Object.assign(
      createChangeEventDetails("drag", event.nativeEvent),
      { edge }
    );
    if (actions.change(next, eventDetails)) {
      gesture.changed = true;
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the range falls back to the known value after.
    const committed = meta.valueRef.current;
    actions.setDragging(false);
    if (gesture.changed) {
      actions.commit(committed, {
        edge,
        event: event.nativeEvent,
        reason: "drag",
      });
    }
  };

  return {
    onLostPointerCapture: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
  };
}

/** Arrow, Page and Home/End targets for a value moved by the keyboard. */
function keyTargets(
  current: number,
  step: number,
  largeStep: number,
  shiftKey: boolean,
  bounds: readonly [number, number]
): Record<string, number> {
  const arrowStep = shiftKey ? largeStep : step;
  return {
    ArrowDown: current - arrowStep,
    ArrowLeft: current - arrowStep,
    ArrowRight: current + arrowStep,
    ArrowUp: current + arrowStep,
    End: bounds[1],
    Home: bounds[0],
    PageDown: current - largeStep,
    PageUp: current + largeStep,
  };
}

/**
 * A stretch of the timeline, such as a loop, a selection or a clip, laid on
 * the lane it sits in from `value[0]` to `value[1]`. Dragging its body moves
 * it, on the grid unless Cmd/Ctrl is held; add a `Timeline.RangeHandle` per
 * edge to resize it. With `drawable`, dragging across empty lane draws a new
 * range. Its own native `<input type="range">` moves it from the keyboard and
 * carries its accessible name (`aria-label` / `aria-labelledby`).
 * Renders a `<div>` element.
 */
export function Range(componentProps: Range.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    defaultValue,
    disabled: disabledProp = false,
    drawable = false,
    getAriaValueText = describeNumber,
    minLength: minLengthProp,
    movable = true,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;
  const { meta: root, state: rootState } = useTimelineContext("Range");
  const lane = React.use(LaneContext);
  if (!lane) {
    throw new Error("Timeline.Range must be used within a Timeline lane");
  }
  const { duration, grid, largeStep, step, zoom } = root;
  const disabled = disabledProp || rootState.disabled;
  const minLength = minLengthProp ?? (grid.step > 0 ? grid.step : step);

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<RangeValue>(
    () => defaultValue ?? [0, duration]
  );
  const [rawStart, rawEnd] = isControlled ? valueProp : uncontrolledValue;
  const value = React.useMemo(
    () => normalizeRange([rawStart, rawEnd], duration),
    [duration, rawEnd, rawStart]
  );

  // While dragging, the range follows the pointer even if a controlled value
  // lags behind; on release the controlled value rules again.
  const [dragging, setDraggingState] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<RangeValue | null>(null);
  const draggingRef = React.useRef(false);
  const displayedValue = dragValue ?? value;
  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  const setDragging = React.useCallback((next: boolean) => {
    draggingRef.current = next;
    setDraggingState(next);
    if (!next) {
      setDragValue(null);
    }
  }, []);

  const change = React.useCallback(
    (next: RangeValue, eventDetails: Range.ChangeEventDetails) => {
      const [start, end] = valueRef.current;
      if (next[0] === start && next[1] === end) {
        return false;
      }
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      valueRef.current = next;
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (isControlled && draggingRef.current) {
        setDragValue(next);
      }
      return true;
    },
    [isControlled, onValueChange]
  );

  const commit = React.useCallback(
    (committed: RangeValue, eventDetails: Range.CommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  const unitsPerPixel = React.useCallback(() => {
    if (zoom !== null) {
      return 1 / zoom;
    }
    const width = lane.elementRef.current?.getBoundingClientRect().width ?? 0;
    return duration / Math.max(width, 1);
  }, [duration, lane.elementRef, zoom]);

  // Drawing a new range across empty lane: listened for on the lane itself,
  // which the range doesn't render.
  React.useEffect(() => {
    const laneElement = lane.elementRef.current;
    if (!(drawable && laneElement) || disabled) {
      return;
    }
    let gesture: {
      anchor: number;
      changed: boolean;
      pointerId: number;
    } | null = null;

    const valueAt = (event: PointerEvent) => {
      const raw = valueAtPointer(laneElement, event.clientX, zoom, duration);
      return bypassesGrid(event) ? raw : snapToGrid(raw, grid);
    };
    const drawTo = (event: PointerEvent, at: number, anchor: number) => {
      const from = Math.min(anchor, at);
      const to = Math.max(from + minLength, Math.max(anchor, at));
      const next = normalizeRange(
        [Math.min(from, duration - minLength), to],
        duration
      );
      return change(
        next,
        Object.assign(createChangeEventDetails("draw", event), {
          edge: "both" as const,
        })
      );
    };

    const handleDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.target !== laneElement) {
        return;
      }
      event.preventDefault();
      laneElement.setPointerCapture?.(event.pointerId);
      const anchor = valueAt(event);
      gesture = { anchor, changed: false, pointerId: event.pointerId };
      setDragging(true);
      gesture.changed = drawTo(event, anchor, anchor);
    };
    const handleMove = (event: PointerEvent) => {
      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }
      if (drawTo(event, valueAt(event), gesture.anchor)) {
        gesture.changed = true;
      }
    };
    const handleEnd = (event: PointerEvent) => {
      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }
      const { changed } = gesture;
      gesture = null;
      const committed = valueRef.current;
      setDragging(false);
      if (changed) {
        commit(committed, { edge: "both", event, reason: "draw" });
      }
    };

    laneElement.addEventListener("pointerdown", handleDown);
    laneElement.addEventListener("pointermove", handleMove);
    laneElement.addEventListener("pointerup", handleEnd);
    laneElement.addEventListener("pointercancel", handleEnd);
    return () => {
      laneElement.removeEventListener("pointerdown", handleDown);
      laneElement.removeEventListener("pointermove", handleMove);
      laneElement.removeEventListener("pointerup", handleEnd);
      laneElement.removeEventListener("pointercancel", handleEnd);
    };
  }, [
    change,
    commit,
    disabled,
    drawable,
    duration,
    grid,
    lane.elementRef,
    minLength,
    setDragging,
    zoom,
  ]);

  const state = React.useMemo<Range.State>(
    () => ({ disabled, dragging }),
    [disabled, dragging]
  );

  const context = React.useMemo<RangeContextValue>(
    () => ({
      actions: { change, commit, setDragging, unitsPerPixel },
      meta: {
        describe: getAriaValueText,
        duration,
        grid,
        largeStep,
        minLength,
        step,
        value: displayedValue,
        valueRef,
      },
      state,
    }),
    [
      change,
      commit,
      displayedValue,
      duration,
      getAriaValueText,
      grid,
      largeStep,
      minLength,
      setDragging,
      state,
      step,
      unitsPerPixel,
    ]
  );

  const drag = useRangeDrag(context, "both", movable && !disabled);
  const [start, end] = displayedValue;
  const length = end - start;

  /** Moves the whole range so it starts at `target`, keeping its length. */
  const moveTo = React.useCallback(
    (target: number, reason: "input-change" | "keyboard", native: Event) => {
      const latest = valueRef.current;
      const span = latest[1] - latest[0];
      const from = Math.min(Math.max(0, target), duration - span);
      const eventDetails = Object.assign(
        createChangeEventDetails(reason, native),
        { edge: "both" as const }
      ) as Range.ChangeEventDetails;
      if (change([from, from + span], eventDetails)) {
        commit(valueRef.current, {
          edge: "both",
          event: native,
          reason,
        } as Range.CommitEventDetails);
      }
    },
    [change, commit, duration]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      const latest = valueRef.current;
      const span = latest[1] - latest[0];
      const target = keyTargets(latest[0], step, largeStep, event.shiftKey, [
        0,
        duration - span,
      ])[event.key];
      if (target === undefined) {
        return;
      }
      event.preventDefault();
      moveTo(target, "keyboard", event.nativeEvent);
    },
    [disabled, duration, largeStep, moveTo, step]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      moveTo(
        Number(event.currentTarget.value),
        "input-change",
        event.nativeEvent
      );
    },
    [moveTo]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...drag,
        children: (
          <>
            {children}
            {movable ? (
              <input
                aria-describedby={ariaDescribedBy}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-valuetext={`${getAriaValueText(start, duration)} to ${getAriaValueText(end, duration)}`}
                disabled={disabled}
                max={Math.max(0, duration - length)}
                min={0}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                step="any"
                style={VISUALLY_HIDDEN}
                type="range"
                value={start}
              />
            ) : null}
          </>
        ),
        style: { ...placedOver(start, length), touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });

  return <RangeContext value={context}>{element}</RangeContext>;
}

export namespace Range {
  export type State = {
    disabled: boolean;
    /** Whether a pointer is moving, resizing or drawing the range. */
    dragging: boolean;
  };

  /** The range, as `[start, end]` in the timeline's units. */
  export type Value = RangeValue;
  export type Edge = RangeEdge;

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | WithEdge<ExtraChangeEventDetails<"drag", PointerEvent>>
    | WithEdge<ExtraChangeEventDetails<"draw", PointerEvent>>
    | WithEdge<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
    | WithEdge<ExtraChangeEventDetails<"input-change", Event>>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | WithEdge<ExtraCommitEventDetails<"drag", PointerEvent>>
    | WithEdge<ExtraCommitEventDetails<"draw", PointerEvent>>
    | WithEdge<ExtraCommitEventDetails<"keyboard", KeyboardEvent>>
    | WithEdge<ExtraCommitEventDetails<"input-change", Event>>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting range. Defaults to the whole timeline. */
    defaultValue?: Value;
    disabled?: boolean;
    /** Whether dragging across empty lane draws a new range. @default false */
    drawable?: boolean;
    /** Returns how a position is announced, for the range and its handles. Defaults to the number. */
    getAriaValueText?: DescribePosition;
    /** The shortest the range can be, in the timeline's units. Defaults to the grid step. */
    minLength?: number;
    /** Whether dragging the body, or its keys, moves the range. @default true */
    movable?: boolean;
    /** Fires while the range is moved, resized or drawn. */
    onValueChange?: (value: Value, eventDetails: ChangeEventDetails) => void;
    /** Fires when a gesture that changed the range ends. */
    onValueCommitted?: (value: Value, eventDetails: CommitEventDetails) => void;
    /** The range, as `[start, end]` in the timeline's units. */
    value?: Value;
  }
}

/**
 * Resizes one edge of the range: by dragging, on the grid unless Cmd/Ctrl is
 * held, or from the keyboard through the native `<input type="range">` it
 * holds, which carries the accessible name. Renders a `<div>` element.
 */
export function RangeHandle(componentProps: RangeHandle.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    edge,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const context = React.use(RangeContext);
  if (!context) {
    throw new Error("Timeline.RangeHandle must be used within Timeline.Range");
  }
  const { actions, meta, state: rangeState } = context;
  const { duration, minLength } = meta;
  const { disabled } = rangeState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const drag = useRangeDrag(context, edge, !disabled);

  const [start, end] = meta.value;
  const current = edge === "start" ? start : end;
  // How far this edge can go before it meets the other one.
  const min = edge === "start" ? 0 : Math.min(duration, start + minLength);
  const max = edge === "start" ? Math.max(0, end - minLength) : duration;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.onPointerDown(event);
    if (!disabled && event.button === 0) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  };

  /** Puts this edge at `target`, within its limits. */
  const setEdge = React.useCallback(
    (target: number, reason: "input-change" | "keyboard", native: Event) => {
      const clamped = Math.min(max, Math.max(min, target));
      const latest = meta.valueRef.current;
      const next: RangeValue =
        edge === "start" ? [clamped, latest[1]] : [latest[0], clamped];
      const eventDetails = Object.assign(
        createChangeEventDetails(reason, native),
        { edge }
      ) as Range.ChangeEventDetails;
      if (actions.change(next, eventDetails)) {
        actions.commit(meta.valueRef.current, {
          edge,
          event: native,
          reason,
        } as Range.CommitEventDetails);
      }
    },
    [actions, edge, max, meta.valueRef, min]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      const target = keyTargets(
        current,
        meta.step,
        meta.largeStep,
        event.shiftKey,
        [min, max]
      )[event.key];
      if (target === undefined) {
        return;
      }
      event.preventDefault();
      setEdge(target, "keyboard", event.nativeEvent);
    },
    [current, disabled, max, meta.largeStep, meta.step, min, setEdge]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEdge(
        Number(event.currentTarget.value),
        "input-change",
        event.nativeEvent
      );
    },
    [setEdge]
  );

  const state = React.useMemo<RangeHandle.State>(
    () => ({ ...rangeState, edge }),
    [edge, rangeState]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...drag,
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={meta.describe(current, duration)}
              disabled={disabled}
              max={max}
              min={min}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={current}
            />
          </>
        ),
        onPointerDown: handlePointerDown,
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace RangeHandle {
  export type State = Range.State & {
    /** The edge this handle resizes. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the range this handle resizes. */
    edge: "end" | "start";
  }
}
