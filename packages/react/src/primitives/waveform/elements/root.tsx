import { clampFinite, createStore, normalizeRange } from "@audio-ui/core";
import type { WaveformPeaks } from "@audio-ui/core/waveform";
import {
  createWaveformController,
  isAudible,
  type WaveformSeekOptions,
} from "@audio-ui/core/waveform";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  describeAsPercent,
  type LevelsSource,
  POSITION_PROPERTY,
  type PositionSource,
  type SeekChangeEventDetails,
  type SeekCommitEventDetails,
  WaveformContext,
  type WaveformContextValue,
  type WaveformState,
} from "../context.ts";

/**
 * Groups the parts of a waveform and owns what they show: the audio's shape
 * (`peaks`, known upfront, or a live `levels` signal) and, for a seekable one,
 * the playback position in `duration` units.
 *
 * The position comes from `value`, or from a live `source` that the waveform
 * follows straight in the DOM without re-rendering React; it is exposed as the
 * `--waveform-position` CSS variable (a percentage). While a live signal is
 * audible the element carries `data-active`. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultValue = 0,
    disabled = false,
    duration = 1,
    largeStep: largeStepProp,
    levels,
    loading = false,
    onValueChange,
    onValueCommitted,
    peaks,
    range: rangeProp,
    ref,
    render,
    source,
    step: stepProp,
    style,
    value,
    ...elementProps
  } = componentProps;
  const step = stepProp ?? duration / 100;
  const largeStep = largeStepProp ?? duration / 10;

  // The stretch of the audio shown: the whole of it unless told otherwise.
  const [rangeStart, rangeEnd] = rangeProp
    ? normalizeRange(rangeProp, duration)
    : [0, duration];
  const range = React.useMemo<readonly [number, number]>(
    () => (rangeEnd > rangeStart ? [rangeStart, rangeEnd] : [0, duration]),
    [duration, rangeEnd, rangeStart]
  );

  const options: WaveformSeekOptions = {
    defaultValue,
    disabled,
    duration,
    largeStep,
    loading,
    onValueChange,
    onValueCommitted,
    range,
    source,
    step,
    value,
  };
  const [controller] = React.useState(() => createWaveformController(options));
  // Set on every render, so the waveform always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  const knownValue = snapshot.value;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const describeRef = React.useRef(describeAsPercent);
  const [position] = React.useState(() =>
    createStore(controller.toShare(knownValue))
  );

  // The single place a position reaches the DOM: the CSS variable the
  // playhead and thumb follow, the store the canvas repaints from, and the
  // input assistive technology reads. Outside React, so a live source paints
  // every frame without a render.
  const paint = React.useCallback(
    (raw: number) => {
      const next = clampFinite(raw, 0, duration);
      const share = controller.toShare(next);
      const root = rootRef.current;
      root?.style.setProperty(
        POSITION_PROPERTY,
        `${Math.min(1, Math.max(0, share)) * 100}%`
      );
      // Outside the stretch shown, a playhead has nowhere true to stand.
      root?.toggleAttribute("data-outside", share < 0 || share > 1);
      position.set(share);
      const input = inputRef.current;
      if (input) {
        const text = describeRef.current(next, duration);
        if (input.getAttribute("aria-valuetext") !== text) {
          input.setAttribute("aria-valuetext", text);
          input.value = String(next);
        }
      }
    },
    [controller, duration, position]
  );

  React.useLayoutEffect(() => {
    paint(knownValue);
  }, [knownValue, paint]);

  React.useEffect(() => {
    if (!source) {
      return;
    }
    const follow = () => {
      paint(controller.getSnapshot().value);
    };
    follow();
    return source.subscribe(follow);
  }, [controller, paint, source]);

  // Whether the live signal is audible, marked outside React like the rest of it.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!(levels && root)) {
      return;
    }
    const mark = () => {
      root.toggleAttribute("data-active", isAudible(levels.getSnapshot()));
    };
    mark();
    const unsubscribe = levels.subscribe(mark);
    return () => {
      unsubscribe();
      root.removeAttribute("data-active");
    };
  }, [levels]);

  const state = React.useMemo<Root.State>(
    () => ({
      disabled: snapshot.disabled,
      dragging: snapshot.dragging,
      loading,
    }),
    [loading, snapshot.disabled, snapshot.dragging]
  );

  const context = React.useMemo<WaveformContextValue>(
    () => ({
      controller,
      meta: {
        atShare: controller.atShare,
        describeRef,
        duration,
        hover: controller.hover,
        inputRef,
        largeStep,
        levels,
        peaks,
        position,
        range,
        step,
        toShare: controller.toShare,
      },
      state,
    }),
    [
      controller,
      duration,
      largeStep,
      levels,
      peaks,
      position,
      range,
      state,
      step,
    ]
  );

  // Mid-drag a re-render must not write a stale position back: the snapshot
  // holds the position the drag is at.
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          [POSITION_PROPERTY]: `${Math.min(1, Math.max(0, controller.toShare(knownValue))) * 100}%`,
        } as React.CSSProperties,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, rootRef] : rootRef,
    render,
    state,
  });

  return <WaveformContext value={context}>{element}</WaveformContext>;
}

export namespace Root {
  export type State = WaveformState;
  export type Source = PositionSource;
  /** The audio's shape: a level per slice, or `{ min, max }` samples per slice. */
  export type Peaks = WaveformPeaks;
  export type Levels = LevelsSource;

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = SeekChangeEventDetails;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails = SeekCommitEventDetails;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting position. @default 0 */
    defaultValue?: number;
    disabled?: boolean;
    /** Length of the audio, in the unit `value` is in (typically seconds). @default 1 */
    duration?: number;
    /** Step for Page Up/Page Down and Shift + arrow keys. Defaults to a tenth of `duration`. */
    largeStep?: number;
    /** A live signal drawn outside React, instead of `peaks`: a microphone, an analyser, a stream. */
    levels?: Levels;
    /** Whether the audio is still on its way. Seeking waits, and the bars sweep. @default false */
    loading?: boolean;
    /** Fires while seeking: press, drag, keyboard and input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when a seek that moved the position ends. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /**
     * The audio's shape, at any resolution: a level per slice (0…1), or the
     * lowest and highest sample of each (`{ min, max }`, -1…1), which draws
     * the waveform lopsided where the audio is. The parts fit it to their size.
     */
    peaks?: WaveformPeaks;
    /**
     * The stretch of the audio to show, `[start, end]` in `duration` units:
     * a clip's window onto its source, a zoomed view. The playhead, seeking,
     * hover, regions and markers all follow it. Defaults to the whole audio.
     * While the position is outside it, the root carries `data-outside`.
     */
    range?: readonly [number, number];
    /** A live position followed outside React; takes precedence over `value`. */
    source?: Source;
    /** Step for the arrow keys. Defaults to a hundredth of `duration`. */
    step?: number;
    /** Playback position, from 0 to `duration`. */
    value?: number;
  }
}
