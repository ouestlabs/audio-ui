import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
} from "@audio-ui/core";
import {
  type ClipChangeEventDetails,
  type ClipCommitEventDetails,
  type ClipOptions,
  type ClipValue,
  createClipController,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import {
  type DescribePosition,
  placedOver,
  useTimelineContext,
} from "../context.ts";
import {
  ClipContext,
  type ClipContextValue,
  type ClipState,
  type ClipTarget,
} from "./clip-context.ts";
import { LaneContext } from "./lane.tsx";
import { useSeekGesture } from "./seek-gesture.ts";

const describeNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

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

  const options: ClipOptions = {
    additive,
    defaultSelected,
    defaultValue,
    disabled,
    duration,
    grid,
    largeStep,
    minLength,
    movable,
    onDragOffsetChange,
    onRemove: onRemove
      ? (event) => onRemove(createChangeEventDetails("keyboard", event))
      : undefined,
    onSelectedChange,
    onValueChange,
    onValueCommitted,
    selected: selectedProp,
    sourceLength,
    step,
    value: valueProp,
    zoom,
  };
  const [controller] = React.useState(() => createClipController(options));
  // Set on every render, so the clip always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  const { dragOffset, value, selected } = snapshot;

  const state = React.useMemo<ClipState>(
    () => ({ disabled, dragging: snapshot.dragging, selected }),
    [disabled, selected, snapshot.dragging]
  );

  const inputRef = React.useRef<HTMLInputElement>(null);
  const focus = React.useCallback(() => {
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
  }, []);

  const context = React.useMemo<ClipContextValue>(
    () => ({
      controller,
      focus,
      laneRef: lane.elementRef,
      meta: {
        describe: getAriaValueText,
        duration,
        largeStep,
        movable: movable && !disabled,
        step,
        value,
      },
      state,
    }),
    [
      controller,
      disabled,
      duration,
      focus,
      getAriaValueText,
      largeStep,
      lane.elementRef,
      movable,
      state,
      step,
      value,
    ]
  );

  // A press on the body selects the clip and puts the cursor there, and a
  // drag scrubs it: it is the header that moves the clip.
  const seek = useSeekGesture(timeline, {
    accepts: () => true,
    enabled: !disabled,
    measure: () => lane.elementRef.current,
    onPress: (event) => controller.select(event),
  });
  const { fadeIn, fadeOut, length, offset, start } = value;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    seek.onPointerDown(event);
    if (!disabled && event.button === 0) {
      focus();
    }
  };

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
          transform: snapshot.dragging
            ? "translateY(var(--clip-drag-y))"
            : undefined,
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
    /** Fires as a move drags the clip up or down, in px from where the press began. It reports 0 when the drag ends, so a group can follow the clip. */
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
