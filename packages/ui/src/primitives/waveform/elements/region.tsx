import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
  isReleased,
  moveRange as moveRegion,
  normalizeRange as normalizeRegion,
  type RangeEdge as RegionEdge,
  type RangeValue as RegionValue,
} from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  type DescribeValue,
  describeAsPercent,
  useWaveformContext,
} from "../context";

type WithEdge<Details> = Details & {
  /** What moved: one edge, or the whole region with `"both"`. */
  edge: RegionEdge;
};

interface RegionContextValue {
  actions: {
    /** Propose a region; returns whether it was applied. */
    change: (
      next: RegionValue,
      eventDetails: Region.ChangeEventDetails
    ) => boolean;
    commit: (
      value: RegionValue,
      eventDetails: Region.CommitEventDetails
    ) => void;
    setDragging: (dragging: boolean) => void;
    /** `duration` units covered by one pixel of the track the region sits on. */
    unitsPerPixel: () => number;
  };
  meta: {
    duration: number;
    largeStep: number;
    minLength: number;
    step: number;
    /** The region as displayed. */
    value: RegionValue;
    /** Latest displayed region, readable from event handlers. */
    valueRef: React.RefObject<RegionValue>;
  };
  state: Region.State;
}

const RegionContext = React.createContext<RegionContextValue | null>(null);

interface RegionGesture {
  /** Whether the gesture changed the region at least once; if so its end commits. */
  changed: boolean;
  /** The region when the pointer went down: the drag is measured from it. */
  origin: RegionValue;
  pointerId: number;
  startX: number;
}

/**
 * Pointer handlers that drag `edge` of the region. The press stops here, so
 * the control underneath doesn't take it for a seek.
 */
function useRegionDrag(
  context: RegionContextValue,
  edge: RegionEdge,
  enabled: boolean
) {
  const { actions, meta } = context;
  const gestureRef = React.useRef<RegionGesture | null>(null);

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
    const eventDetails = Object.assign(
      createChangeEventDetails("drag", event.nativeEvent),
      { edge }
    );
    if (
      actions.change(
        moveRegion(gesture.origin, edge, delta, meta),
        eventDetails
      )
    ) {
      gesture.changed = true;
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the region falls back to the known value after.
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

/**
 * A stretch of the timeline, such as a loop or a selection, laid over the
 * waveform from `value[0]` to `value[1]`. Dragging its body moves it; add a
 * `Waveform.RegionHandle` per edge to resize it. Renders a `<div>` element.
 */
export function Region(componentProps: Region.Props) {
  const {
    className,
    defaultValue,
    disabled: disabledProp = false,
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
  const { meta: root, state: rootState } = useWaveformContext("Region");
  const { duration, largeStep, step } = root;
  const disabled = disabledProp || rootState.disabled;
  const minLength = minLengthProp ?? step;

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<RegionValue>(
    () => defaultValue ?? [0, duration]
  );
  const [rawStart, rawEnd] = isControlled ? valueProp : uncontrolledValue;
  const value = React.useMemo(
    () => normalizeRegion([rawStart, rawEnd], duration),
    [duration, rawEnd, rawStart]
  );

  // While dragging, the region follows the pointer even if a controlled value
  // lags behind; on release the controlled value rules again.
  const [dragging, setDraggingState] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<RegionValue | null>(null);
  const draggingRef = React.useRef(false);
  const displayedValue = dragValue ?? value;
  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;
  const regionRef = React.useRef<HTMLDivElement>(null);

  const setDragging = React.useCallback((next: boolean) => {
    draggingRef.current = next;
    setDraggingState(next);
    if (!next) {
      setDragValue(null);
    }
  }, []);

  const change = React.useCallback(
    (next: RegionValue, eventDetails: Region.ChangeEventDetails) => {
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
    (committed: RegionValue, eventDetails: Region.CommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  const unitsPerPixel = React.useCallback(() => {
    const region = regionRef.current;
    // Its percentages resolve against the element it is positioned in.
    const track = region?.offsetParent ?? region?.parentElement;
    const [shownStart, shownEnd] = root.range;
    return (
      (shownEnd - shownStart) /
      Math.max(track?.getBoundingClientRect().width ?? 0, 1)
    );
  }, [root.range]);

  const state = React.useMemo<Region.State>(
    () => ({ disabled, dragging }),
    [disabled, dragging]
  );

  const context = React.useMemo<RegionContextValue>(
    () => ({
      actions: { change, commit, setDragging, unitsPerPixel },
      meta: {
        duration,
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
      largeStep,
      minLength,
      setDragging,
      state,
      step,
      unitsPerPixel,
    ]
  );

  const drag = useRegionDrag(context, "both", movable && !disabled);
  const [start, end] = displayedValue;
  const span = root.range[1] - root.range[0];
  const toPercent = (length: number) =>
    `${(span > 0 ? length / span : 0) * 100}%`;

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...drag,
        style: {
          left: toPercent(start - root.range[0]),
          position: "absolute",
          touchAction: "none",
          width: toPercent(end - start),
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, regionRef] : regionRef,
    render,
    state,
  });

  return <RegionContext value={context}>{element}</RegionContext>;
}

export namespace Region {
  export type State = {
    disabled: boolean;
    /** Whether a pointer is moving or resizing the region. */
    dragging: boolean;
  };

  /** The region, as `[start, end]` in `duration` units. */
  export type Value = RegionValue;
  export type Edge = RegionEdge;

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | WithEdge<ExtraChangeEventDetails<"drag", PointerEvent>>
    | WithEdge<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
    | WithEdge<ExtraChangeEventDetails<"input-change", Event>>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | WithEdge<ExtraCommitEventDetails<"drag", PointerEvent>>
    | WithEdge<ExtraCommitEventDetails<"keyboard", KeyboardEvent>>
    | WithEdge<ExtraCommitEventDetails<"input-change", Event>>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting region. Defaults to the whole timeline. */
    defaultValue?: Value;
    disabled?: boolean;
    /** The shortest the region can be resized to, in `duration` units. Defaults to the root's `step`. */
    minLength?: number;
    /** Whether dragging the region's body moves it. @default true */
    movable?: boolean;
    /** Fires while the region is moved or resized. */
    onValueChange?: (value: Value, eventDetails: ChangeEventDetails) => void;
    /** Fires when a move or a resize that changed the region ends. */
    onValueCommitted?: (value: Value, eventDetails: CommitEventDetails) => void;
    /** The region, as `[start, end]` in `duration` units. */
    value?: Value;
  }
}

/**
 * Resizes one edge of the region: by dragging, or from the keyboard through
 * the native `<input type="range">` it holds, which carries the accessible
 * name (`aria-label` / `aria-labelledby`). Renders a `<div>` element.
 */
export function RegionHandle(componentProps: RegionHandle.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    edge,
    getAriaValueText = describeAsPercent,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const context = React.use(RegionContext);
  if (!context) {
    throw new Error(
      "Waveform.RegionHandle must be used within Waveform.Region"
    );
  }
  const { actions, meta, state: regionState } = context;
  const { duration, minLength } = meta;
  const { disabled } = regionState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const drag = useRegionDrag(context, edge, !disabled);

  const [start, end] = meta.value;
  const current = edge === "start" ? start : end;
  // How far this edge can go before it meets the other one.
  const min = edge === "start" ? 0 : Math.min(duration, start + minLength);
  const max = edge === "start" ? Math.max(0, end - minLength) : duration;

  /** The region with this edge at `position`, within its limits. */
  const withEdgeAt = React.useCallback(
    (position: number): RegionValue => {
      const latest = meta.valueRef.current;
      const from = edge === "start" ? latest[0] : latest[1];
      return moveRegion(latest, edge, position - from, meta);
    },
    [edge, meta]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.onPointerDown(event);
    if (!disabled && event.button === 0) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      const arrowStep = event.shiftKey ? meta.largeStep : meta.step;
      const targets: Record<string, number> = {
        ArrowDown: current - arrowStep,
        ArrowLeft: current - arrowStep,
        ArrowRight: current + arrowStep,
        ArrowUp: current + arrowStep,
        End: max,
        Home: min,
        PageDown: current - meta.largeStep,
        PageUp: current + meta.largeStep,
      };
      const next = targets[event.key];
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      const native = event.nativeEvent;
      const eventDetails = Object.assign(
        createChangeEventDetails("keyboard", native),
        { edge }
      );
      if (actions.change(withEdgeAt(next), eventDetails)) {
        actions.commit(meta.valueRef.current, {
          edge,
          event: native,
          reason: "keyboard",
        });
      }
    },
    [actions, current, disabled, edge, max, meta, min, withEdgeAt]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      const eventDetails = Object.assign(
        createChangeEventDetails("input-change", native),
        { edge }
      );
      if (
        actions.change(
          withEdgeAt(Number(event.currentTarget.value)),
          eventDetails
        )
      ) {
        actions.commit(meta.valueRef.current, {
          edge,
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, edge, meta, withEdgeAt]
  );

  const state = React.useMemo<RegionHandle.State>(
    () => ({ ...regionState, edge }),
    [edge, regionState]
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
              aria-valuetext={getAriaValueText(current, duration)}
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

export namespace RegionHandle {
  export type State = Region.State & {
    /** The edge this handle resizes. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the region this handle resizes. */
    edge: "end" | "start";
    /** Returns how the edge's position is announced, e.g. `"0:12"`. Defaults to its share of the timeline, e.g. `"30%"`. */
    getAriaValueText?: DescribeValue;
  }
}
