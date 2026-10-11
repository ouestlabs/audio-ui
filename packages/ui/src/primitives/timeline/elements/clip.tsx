import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
} from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { type ClipLimits, type ClipValue, moveClip } from "../clip";
import {
  type DescribePosition,
  placedOver,
  useTimelineContext,
} from "../context";
import {
  type ClipChangeEventDetails,
  type ClipCommitEventDetails,
  ClipContext,
  type ClipContextValue,
  type ClipState,
  type ClipTarget,
  keyTargets,
} from "./clip-context";
import { LaneContext } from "./lane";
import { useSeekGesture } from "./seek-gesture";

const describeNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

/** Fallback for a clip's `value` when none is given: the whole timeline, from the source's start. */
const whole = (duration: number): ClipValue => ({
  fadeIn: 0,
  fadeOut: 0,
  length: duration,
  offset: 0,
  start: 0,
});

/** Keeps a given clip well-formed: finite, on the timeline, fades within its length. */
function normalizeClip(clip: ClipValue, duration: number): ClipValue {
  const finite = (value: number, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
  const start = Math.min(duration, Math.max(0, finite(clip.start)));
  const length = Math.min(duration - start, Math.max(0, finite(clip.length)));
  const fadeIn = Math.min(length, Math.max(0, finite(clip.fadeIn)));
  const fadeOut = Math.min(length - fadeIn, Math.max(0, finite(clip.fadeOut)));
  return {
    fadeIn,
    fadeInShape: clip.fadeInShape,
    fadeOut,
    fadeOutShape: clip.fadeOutShape,
    length,
    offset: Math.max(0, finite(clip.offset)),
    start,
  };
}

/**
 * A stretch of a source laid on a lane: a recording, a pattern. Dragging its
 * `Timeline.ClipHeader` moves it, on the grid unless Cmd/Ctrl is held, and
 * over other lanes too (the change says which one is under the pointer);
 * pressing its body selects it and puts the cursor there. Add a
 * `Timeline.ClipHandle` per edge to trim it, which moves where in the source
 * it begins instead of stretching it, and a `Timeline.ClipFadeHandle` per
 * fade. Its content is up to you: it sets `--clip-offset` and
 * `--clip-source-length` so a waveform can show the stretch that is played.
 * Its own native `<input type="range">` moves it from the keyboard and
 * carries its accessible name (`aria-label` / `aria-labelledby`); Delete and
 * Backspace on it call `onRemove`. Renders a `<div>` element.
 */
export function Clip(componentProps: Clip.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    additive = false,
    children,
    className,
    defaultSelected = false,
    defaultValue,
    disabled: disabledProp = false,
    getAriaValueText = describeNumber,
    minLength: minLengthProp,
    movable = true,
    onDragOffsetChange,
    onRemove,
    onSelectedChange,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    selected: selectedProp,
    sourceLength,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;
  const timeline = useTimelineContext("Clip");
  const { meta: root, state: rootState } = timeline;
  const lane = React.use(LaneContext);
  if (!lane) {
    throw new Error("Timeline.Clip must be used within a Timeline lane");
  }
  const { duration, grid, largeStep, step, zoom } = root;
  const disabled = disabledProp || rootState.disabled;
  const minLength = minLengthProp ?? (grid.step > 0 ? grid.step : step);
  const limits = React.useMemo<ClipLimits>(
    () => ({ duration, minLength, sourceLength }),
    [duration, minLength, sourceLength]
  );

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<ClipValue>(
    () => defaultValue ?? whole(duration)
  );
  const given = isControlled ? valueProp : uncontrolledValue;
  const value = React.useMemo(
    () => normalizeClip(given, duration),
    [duration, given]
  );

  const isSelectionControlled = selectedProp !== undefined;
  const [uncontrolledSelected, setUncontrolledSelected] =
    React.useState(defaultSelected);
  const selected = isSelectionControlled ? selectedProp : uncontrolledSelected;

  // While dragging, the clip follows the pointer even if a controlled value
  // lags behind; on release the controlled value rules again.
  const [dragging, setDraggingState] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<ClipValue | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const draggingRef = React.useRef(false);
  const displayedValue = dragValue ?? value;
  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  // Read at call time, so the actions below stay the same as the callback changes.
  const offsetCallbackRef = React.useRef(onDragOffsetChange);
  offsetCallbackRef.current = onDragOffsetChange;
  const reportOffset = React.useCallback((pixels: number) => {
    setDragOffset(pixels);
    offsetCallbackRef.current?.(pixels);
  }, []);

  const setDragging = React.useCallback(
    (next: boolean) => {
      draggingRef.current = next;
      setDraggingState(next);
      if (!next) {
        setDragValue(null);
        reportOffset(0);
      }
    },
    [reportOffset]
  );

  const change = React.useCallback(
    (next: ClipValue, eventDetails: ClipChangeEventDetails) => {
      const { current } = valueRef;
      if (
        next.start === current.start &&
        next.length === current.length &&
        next.offset === current.offset &&
        next.fadeIn === current.fadeIn &&
        next.fadeOut === current.fadeOut &&
        next.fadeInShape === current.fadeInShape &&
        next.fadeOutShape === current.fadeOutShape
      ) {
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
    (committed: ClipValue, eventDetails: ClipCommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  const select = React.useCallback(
    (event: PointerEvent) => {
      // A selected clip is not reported again, unless the press carries Shift,
      // Cmd or Ctrl, or the clip is `additive`: that is how a selection is
      // added to or taken from.
      if (
        selected &&
        !(additive || event.shiftKey || event.metaKey || event.ctrlKey)
      ) {
        return;
      }
      const eventDetails = createChangeEventDetails("press", event);
      onSelectedChange?.(true, eventDetails);
      if (!(eventDetails.isCanceled || isSelectionControlled)) {
        setUncontrolledSelected(true);
      }
    },
    [additive, isSelectionControlled, onSelectedChange, selected]
  );

  const unitsPerPixel = React.useCallback(() => {
    if (zoom !== null) {
      return 1 / zoom;
    }
    const width = lane.elementRef.current?.getBoundingClientRect().width ?? 0;
    return duration / Math.max(width, 1);
  }, [duration, lane.elementRef, zoom]);

  const state = React.useMemo<ClipState>(
    () => ({ disabled, dragging, selected }),
    [disabled, dragging, selected]
  );

  const inputRef = React.useRef<HTMLInputElement>(null);
  const focus = React.useCallback(() => {
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
  }, []);

  const context = React.useMemo<ClipContextValue>(
    () => ({
      actions: {
        change,
        commit,
        focus,
        select,
        setDragOffset: reportOffset,
        setDragging,
        unitsPerPixel,
      },
      meta: {
        describe: getAriaValueText,
        duration,
        grid,
        largeStep,
        limits,
        movable: movable && !disabled,
        step,
        value: displayedValue,
        valueRef,
      },
      state,
    }),
    [
      change,
      commit,
      disabled,
      displayedValue,
      duration,
      focus,
      getAriaValueText,
      grid,
      largeStep,
      limits,
      movable,
      reportOffset,
      select,
      setDragging,
      state,
      step,
      unitsPerPixel,
    ]
  );

  // A press on the body selects the clip and puts the cursor there, and a
  // drag scrubs it: it is the header that moves the clip.
  const seek = useSeekGesture(timeline, {
    accepts: () => true,
    enabled: !disabled,
    measure: () => lane.elementRef.current,
    onPress: select,
  });
  const { fadeIn, fadeOut, length, offset, start } = displayedValue;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    seek.onPointerDown(event);
    if (!disabled && event.button === 0) {
      focus();
    }
  };

  /** Moves the whole clip so it starts at `target`. */
  const moveTo = React.useCallback(
    (target: number, reason: "input-change" | "keyboard", native: Event) => {
      const next = moveClip(valueRef.current, target, limits);
      const eventDetails = Object.assign(
        createChangeEventDetails(reason, native),
        { target: "move" as const }
      ) as ClipChangeEventDetails;
      if (change(next, eventDetails)) {
        commit(valueRef.current, {
          event: native,
          reason,
          target: "move",
        } as ClipCommitEventDetails);
      }
    },
    [change, commit, limits]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onRemove?.(createChangeEventDetails("keyboard", event.nativeEvent));
        return;
      }
      const latest = valueRef.current;
      const targets = keyTargets(
        latest.start,
        step,
        largeStep,
        event.shiftKey,
        [0, Math.max(0, duration - latest.length)]
      );
      const target = targets[event.key];
      if (target === undefined) {
        return;
      }
      event.preventDefault();
      moveTo(target, "keyboard", event.nativeEvent);
    },
    [disabled, duration, largeStep, moveTo, onRemove, step]
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
        ...seek,
        children: (
          <>
            {children}
            {movable ? (
              <input
                aria-describedby={ariaDescribedBy}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-valuetext={`${getAriaValueText(start, duration)} to ${getAriaValueText(start + length, duration)}`}
                disabled={disabled}
                max={Math.max(0, duration - length)}
                min={0}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                ref={inputRef}
                step="any"
                style={VISUALLY_HIDDEN}
                type="range"
                value={start}
              />
            ) : null}
          </>
        ),
        onPointerDown: handlePointerDown,
        style: {
          ...placedOver(start, length),
          "--clip-drag-y": `${dragOffset}px`,
          "--clip-fade-in": fadeIn,
          "--clip-fade-out": fadeOut,
          "--clip-offset": offset,
          ...(sourceLength === undefined
            ? {}
            : { "--clip-source-length": sourceLength }),
          touchAction: "none",
          transform: dragging ? "translateY(var(--clip-drag-y))" : undefined,
        } as React.CSSProperties,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });

  return <ClipContext value={context}>{element}</ClipContext>;
}

export namespace Clip {
  export type State = ClipState;
  /** The clip, in the timeline's units: where it is, how long, where in the source it begins, and its fades. */
  export type Value = ClipValue;
  export type Target = ClipTarget;
  export type ChangeEventReason = ClipChangeEventDetails["reason"];
  export type ChangeEventDetails = ClipChangeEventDetails;
  export type CommitEventReason = ClipCommitEventDetails["reason"];
  export type CommitEventDetails = ClipCommitEventDetails;
  export type SelectEventDetails = ExtraChangeEventDetails<
    "press",
    PointerEvent
  >;
  export type RemoveEventDetails = ExtraChangeEventDetails<
    "keyboard",
    KeyboardEvent
  >;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /**
     * Whether every press is reported, as one with Shift, Cmd or Ctrl held is:
     * for building a selection where there are no modifier keys, such as a
     * touch screen. @default false
     */
    additive?: boolean;
    /** Whether the clip starts selected, when `selected` is not set. @default false */
    defaultSelected?: boolean;
    /** Uncontrolled starting clip. Defaults to the whole timeline. */
    defaultValue?: Value;
    disabled?: boolean;
    /** Returns how a position is announced. Defaults to the number. */
    getAriaValueText?: DescribePosition;
    /** The shortest the clip can be trimmed to, in the timeline's units. Defaults to the grid step. */
    minLength?: number;
    /** Whether dragging the header, or the keys, moves the clip. @default true */
    movable?: boolean;
    /** Fires as a move drags the clip up or down, in px from where the press began, and with 0 when the drag ends: what a group follows. */
    onDragOffsetChange?: (offset: number) => void;
    /** Fires when Delete or Backspace is pressed on the clip: removing it is up to you. */
    onRemove?: (eventDetails: RemoveEventDetails) => void;
    /** Fires when a press on the clip selects it, and again on a press with Shift, Cmd or Ctrl held (or any, when `additive`), which `eventDetails.event` carries. */
    onSelectedChange?: (
      selected: boolean,
      eventDetails: SelectEventDetails
    ) => void;
    /** Fires while the clip is moved, trimmed or faded. */
    onValueChange?: (value: Value, eventDetails: ChangeEventDetails) => void;
    /** Fires when a gesture that changed the clip ends, or one that dropped it on another lane. */
    onValueCommitted?: (value: Value, eventDetails: CommitEventDetails) => void;
    selected?: boolean;
    /** How long the source is, in the timeline's units: trimming stops where it runs out. Defaults to no limit. */
    sourceLength?: number;
    value?: Value;
  }
}
