import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "@audio-ui/core";
import {
  createWaveformRegionController,
  type WaveformRegionController,
  type WaveformRegionEdge,
  type WaveformRegionOptions,
  type WaveformRegionValue,
} from "@audio-ui/core/waveform";
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
  edge: WaveformRegionEdge;
};

interface RegionContextValue {
  controller: WaveformRegionController;
  /** The region's element: the track it sits on is its offset parent. */
  regionRef: React.RefObject<HTMLDivElement | null>;
  /** The stretch of the audio shown, `[start, end]` in `duration` units. */
  shownRange: readonly [number, number];
  state: Region.State;
  /** The region as displayed. */
  value: WaveformRegionValue;
}

const RegionContext = React.createContext<RegionContextValue | null>(null);

/** The element a region's pixels are measured on: the track it is positioned in. */
function trackOf(region: Element | null): Element | null {
  if (!region) {
    return null;
  }
  return (region as HTMLElement).offsetParent ?? region.parentElement;
}

/**
 * Pointer handler that drags `edge` of the region. The press stops here, so
 * the control underneath doesn't take it for a seek.
 */
function useRegionDrag(
  context: RegionContextValue,
  edge: WaveformRegionEdge,
  enabled: boolean
) {
  const { controller, regionRef, shownRange } = context;

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
      trackOf(regionRef.current),
      shownRange
    );
  };

  return { onPointerDown };
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
  const { duration, largeStep, range, step } = root;
  const disabled = disabledProp || rootState.disabled;
  const minLength = minLengthProp ?? step;

  const options: WaveformRegionOptions = {
    defaultValue,
    disabled,
    duration,
    largeStep,
    minLength,
    onValueChange,
    onValueCommitted,
    step,
    value: valueProp,
  };
  const [controller] = React.useState(() =>
    createWaveformRegionController(options)
  );
  // Set on every render, so the region always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );

  const regionRef = React.useRef<HTMLDivElement>(null);
  const state = React.useMemo<Region.State>(
    () => ({ disabled: snapshot.disabled, dragging: snapshot.dragging }),
    [snapshot.disabled, snapshot.dragging]
  );

  const context = React.useMemo<RegionContextValue>(
    () => ({
      controller,
      regionRef,
      shownRange: range,
      state,
      value: snapshot.value,
    }),
    [controller, range, snapshot.value, state]
  );

  const drag = useRegionDrag(context, "both", movable && !disabled);
  const [start, end] = snapshot.value;
  const span = range[1] - range[0];
  const toPercent = (length: number) =>
    `${(span > 0 ? length / span : 0) * 100}%`;

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...drag,
        style: {
          left: toPercent(start - range[0]),
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
  export type Value = WaveformRegionValue;
  export type Edge = WaveformRegionEdge;

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
  const { controller, state: regionState, value } = context;
  const { duration } = useWaveformContext("RegionHandle").meta;
  const { disabled } = regionState;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const drag = useRegionDrag(context, edge, !disabled);

  const [start, end] = value;
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
      if (controller.keyDown(edge, event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller, edge]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.typeAt(
        edge,
        Number(event.currentTarget.value),
        event.nativeEvent
      );
    },
    [controller, edge]
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
