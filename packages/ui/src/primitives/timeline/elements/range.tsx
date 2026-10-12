import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
  RangeEdge,
  RangeValue,
} from "@audio-ui/core";
import {
  createRangeController,
  type RangeController,
  type RangeOptions,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import {
  type DescribePosition,
  placedOver,
  useTimelineContext,
} from "../context.js";
import { LaneContext } from "./lane.js";

type WithEdge<Details> = Details & {
  /** What moved: one edge, or the whole range with `"both"`. */
  edge: RangeEdge;
};

const describeNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

interface RangeContextValue {
  /** The framework-free range behind every part: its span, drags, drawing and keys. */
  controller: RangeController;
  /** The lane the range sits on: what a pointer's px are measured along. */
  laneRef: React.RefObject<HTMLElement | null>;
  meta: {
    describe: DescribePosition;
    duration: number;
    largeStep: number;
    step: number;
    /** The range as displayed. */
    value: RangeValue;
  };
  state: Range.State;
}

const RangeContext = React.createContext<RangeContextValue | null>(null);

/**
 * Pointer handler that drags `edge` of the range, on the grid unless Cmd/Ctrl
 * is held. The press stops here, so the lane underneath doesn't take it.
 */
function useRangeDrag(
  context: RangeContextValue,
  edge: RangeEdge,
  enabled: boolean
) {
  const { controller, laneRef } = context;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (!enabled) {
      return;
    }
    event.preventDefault();
    controller.press(
      edge,
      event.nativeEvent,
      event.currentTarget,
      laneRef.current
    );
  };

  return { onPointerDown };
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

  const options: RangeOptions = {
    defaultValue,
    disabled,
    drawable,
    duration,
    grid,
    largeStep,
    minLength,
    movable,
    onValueChange,
    onValueCommitted,
    step,
    value: valueProp,
    zoom,
  };
  const [controller] = React.useState(() => createRangeController(options));
  // Set on every render, so the range always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );

  // Drawing a new range across empty lane: the press is listened for on the
  // lane itself, which the range doesn't render.
  React.useEffect(() => {
    const laneElement = lane.elementRef.current;
    if (!(drawable && laneElement) || disabled) {
      return;
    }
    const handleDown = (event: PointerEvent) => {
      controller.pressDraw(event, laneElement);
    };
    laneElement.addEventListener("pointerdown", handleDown);
    return () => {
      laneElement.removeEventListener("pointerdown", handleDown);
    };
  }, [controller, disabled, drawable, lane.elementRef]);

  const state = React.useMemo<Range.State>(
    () => ({ disabled, dragging: snapshot.dragging }),
    [disabled, snapshot.dragging]
  );

  const context = React.useMemo<RangeContextValue>(
    () => ({
      controller,
      laneRef: lane.elementRef,
      meta: {
        describe: getAriaValueText,
        duration,
        largeStep,
        step,
        value: snapshot.value,
      },
      state,
    }),
    [
      controller,
      duration,
      getAriaValueText,
      largeStep,
      lane.elementRef,
      snapshot.value,
      state,
      step,
    ]
  );

  const drag = useRangeDrag(context, "both", movable && !disabled);
  const [start, end] = snapshot.value;
  const length = end - start;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.moveTypeAt(
        Number(event.currentTarget.value),
        event.nativeEvent
      );
    },
    [controller]
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
  const { controller, meta, state: rangeState } = context;
  const { duration } = meta;
  const { disabled } = rangeState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const drag = useRangeDrag(context, edge, !disabled);

  const [start, end] = meta.value;
  const current = edge === "start" ? start : end;
  // How far this edge can go before it meets the other one.
  const [min, max] = controller.edgeRange(edge);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.onPointerDown(event);
    if (!disabled && event.button === 0) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.edgeKeyDown(edge, event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller, edge]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.edgeTypeAt(
        edge,
        Number(event.currentTarget.value),
        event.nativeEvent
      );
    },
    [controller, edge]
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
