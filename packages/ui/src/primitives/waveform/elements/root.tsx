import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clampFinite } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { normalizeRange } from "../../internal/range-geometry";
import { createStore } from "../../internal/store";
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
} from "../context";
import { isAudible } from "../internal/levels";
import type { WaveformPeaks } from "../internal/peaks";

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
    value: valueProp,
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
  const toShare = React.useCallback(
    (value: number) =>
      range[1] > range[0] ? (value - range[0]) / (range[1] - range[0]) : 0,
    [range]
  );
  const atShare = React.useCallback(
    (share: number) => range[0] + share * (range[1] - range[0]),
    [range]
  );

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  // The position React knows about: the source's snapshot, or props/state.
  let knownValue = isControlled ? valueProp : uncontrolledValue;
  if (source) {
    knownValue = source.getSnapshot();
  }
  knownValue = clampFinite(knownValue, 0, duration);
  const knownValueRef = React.useRef(knownValue);
  knownValueRef.current = knownValue;

  const [dragging, setDraggingState] = React.useState(false);
  const draggingRef = React.useRef<boolean>(false);
  const valueRef = React.useRef(knownValue);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const describeRef = React.useRef(describeAsPercent);
  const [position] = React.useState(() => createStore(toShare(knownValue)));
  const [hover] = React.useState(() => createStore<number | null>(null));

  // The single place a position reaches the DOM: the CSS variable the
  // playhead and thumb follow, the store the canvas repaints from, and the
  // input assistive technology reads.
  const paint = React.useCallback(
    (value: number) => {
      const next = clampFinite(value, 0, duration);
      valueRef.current = next;
      const share = toShare(next);
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
    [duration, position, toShare]
  );

  // While the pointer drags, the waveform follows it: neither a lagging
  // controlled value nor the live source may pull the position back.
  React.useEffect(() => {
    if (!draggingRef.current) {
      paint(knownValue);
    }
  }, [knownValue, paint]);

  React.useEffect(() => {
    if (!source) {
      return;
    }
    const follow = () => {
      if (!draggingRef.current) {
        paint(source.getSnapshot());
      }
    };
    follow();
    return source.subscribe(follow);
  }, [paint, source]);

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

  const setDragging = React.useCallback(
    (next: boolean) => {
      draggingRef.current = next;
      setDraggingState(next);
      if (!next) {
        // The drag is over: the known position rules again.
        paint(knownValueRef.current);
      }
    },
    [paint]
  );

  const change = React.useCallback(
    (raw: number, eventDetails: Root.ChangeEventDetails) => {
      const next = clampFinite(raw, 0, duration);
      if (next === valueRef.current) {
        return false;
      }
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      paint(next);
      if (!(isControlled || source)) {
        knownValueRef.current = next;
        setUncontrolledValue(next);
      }
      return true;
    },
    [duration, isControlled, onValueChange, paint, source]
  );

  const commit = React.useCallback(
    (committed: number, eventDetails: Root.CommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  const state = React.useMemo<Root.State>(
    () => ({ disabled, dragging, loading }),
    [disabled, dragging, loading]
  );

  const context = React.useMemo<WaveformContextValue>(
    () => ({
      actions: { change, commit, setDragging },
      meta: {
        atShare,
        describeRef,
        duration,
        hover,
        inputRef,
        largeStep,
        levels,
        peaks,
        position,
        range,
        step,
        toShare,
        valueRef,
      },
      state,
    }),
    [
      change,
      commit,
      duration,
      hover,
      largeStep,
      levels,
      peaks,
      position,
      range,
      setDragging,
      state,
      step,
      atShare,
      toShare,
    ]
  );

  // Mid-drag a re-render must not write a stale position back.
  const renderedValue = draggingRef.current ? valueRef.current : knownValue;
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          [POSITION_PROPERTY]: `${Math.min(1, Math.max(0, toShare(renderedValue))) * 100}%`,
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
    /** A live signal drawn outside React, in place of `peaks`: a microphone, an analyser, a stream. */
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
