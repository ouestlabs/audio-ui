import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clampFinite, clampUnit } from "../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "./internal/event-details";
import { type PartProps, resolveStyling } from "./internal/part";
import { createStore, type Store } from "./internal/store";
import { VISUALLY_HIDDEN } from "./internal/visually-hidden";
import {
  barCount,
  barRect,
  resamplePeaks,
  type WaveformVariant,
} from "./internal/waveform-bars";

const POSITION_PROPERTY = "--waveform-position";
const BAR_RADIUS_PROPERTY = "--waveform-bar-radius";
const THEME_ATTRIBUTES = ["class", "style", "data-theme"];

let barRadiusPropertyRegistered = false;

/**
 * Registers the bar radius as a CSS length, so a themed value such as
 * `min(var(--radius-sm), 3px)` computes to pixels the canvas can draw with.
 */
function registerBarRadiusProperty() {
  if (barRadiusPropertyRegistered) {
    return;
  }
  barRadiusPropertyRegistered = true;
  if (typeof CSS === "undefined" || !("registerProperty" in CSS)) {
    return;
  }
  try {
    CSS.registerProperty({
      inherits: true,
      initialValue: "0px",
      name: BAR_RADIUS_PROPERTY,
      syntax: "<length>",
    });
  } catch {
    // Already registered by another copy of the library.
  }
}

/** A share of the track is meaningful whatever unit `duration` is in. */
const describeAsPercent: NonNullable<Control.Props["getAriaValueText"]> = (
  value,
  duration
) => `${Math.round((duration > 0 ? value / duration : 0) * 100)}%`;

interface WaveformContextValue {
  actions: {
    /** Clamp and propose a position; returns whether it was applied. */
    change: (next: number, eventDetails: Root.ChangeEventDetails) => boolean;
    commit: (value: number, eventDetails: Root.CommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
  };
  meta: {
    /** How the position is announced; set by `Control`, used on every paint. */
    describeRef: React.RefObject<
      NonNullable<Control.Props["getAriaValueText"]>
    >;
    duration: number;
    /** The hovered position in `duration` units, or null. */
    hover: Store<number | null>;
    inputRef: React.RefObject<HTMLInputElement | null>;
    largeStep: number;
    peaks: ArrayLike<number> | undefined;
    /** The played share, 0…1, observable outside React. */
    position: Store<number>;
    step: number;
    /** Latest painted position, readable from event handlers. */
    valueRef: React.RefObject<number>;
  };
  state: Root.State;
}

const WaveformContext = React.createContext<WaveformContextValue | null>(null);

function useWaveformContext(part: string): WaveformContextValue {
  const context = React.use(WaveformContext);
  if (!context) {
    throw new Error(`Waveform.${part} must be used within Waveform.Root`);
  }
  return context;
}

/**
 * Groups the parts of a seekable waveform and owns the playback position, in
 * `duration` units. The position comes from `value`, or from a live `source`
 * that the waveform follows straight in the DOM without re-rendering React.
 * It is exposed as the `--waveform-position` CSS variable (a percentage).
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultValue = 0,
    disabled = false,
    duration = 1,
    largeStep: largeStepProp,
    onValueChange,
    onValueCommitted,
    peaks,
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
  const draggingRef = React.useRef(false);
  const valueRef = React.useRef(knownValue);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const describeRef = React.useRef(describeAsPercent);
  const [position] = React.useState(() =>
    createStore(duration > 0 ? knownValue / duration : 0)
  );
  const [hover] = React.useState(() => createStore<number | null>(null));

  // The single place a position reaches the DOM: the CSS variable the
  // playhead and thumb follow, the store the canvas repaints from, and the
  // input assistive technology reads.
  const paint = React.useCallback(
    (value: number) => {
      const next = clampFinite(value, 0, duration);
      valueRef.current = next;
      const fraction = duration > 0 ? next / duration : 0;
      rootRef.current?.style.setProperty(
        POSITION_PROPERTY,
        `${fraction * 100}%`
      );
      position.set(fraction);
      const input = inputRef.current;
      if (input) {
        const text = describeRef.current(next, duration);
        if (input.getAttribute("aria-valuetext") !== text) {
          input.setAttribute("aria-valuetext", text);
          input.value = String(next);
        }
      }
    },
    [duration, position]
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
    () => ({ disabled, dragging }),
    [disabled, dragging]
  );

  const context = React.useMemo<WaveformContextValue>(
    () => ({
      actions: { change, commit, setDragging },
      meta: {
        describeRef,
        duration,
        hover,
        inputRef,
        largeStep,
        peaks,
        position,
        step,
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
      peaks,
      position,
      setDragging,
      state,
      step,
    ]
  );

  // Mid-drag a re-render must not write a stale position back.
  const renderedValue = draggingRef.current ? valueRef.current : knownValue;
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          [POSITION_PROPERTY]: `${(duration > 0 ? renderedValue / duration : 0) * 100}%`,
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
  export type State = {
    disabled: boolean;
    /** Whether a pointer is scrubbing the waveform. */
    dragging: boolean;
  };

  /**
   * A live playback position, in the shape of an external store: `subscribe`
   * registers a listener called on each change, `getSnapshot` returns the
   * current position in `duration` units.
   */
  export interface Source {
    getSnapshot: () => number;
    subscribe: (listener: () => void) => () => void;
  }

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | ExtraChangeEventDetails<"press", PointerEvent>
    | ExtraChangeEventDetails<"drag", PointerEvent>
    | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
    | ExtraChangeEventDetails<"input-change", Event>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"press", PointerEvent>
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"input-change", Event>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting position. @default 0 */
    defaultValue?: number;
    disabled?: boolean;
    /** Length of the audio, in the unit `value` is in (typically seconds). @default 1 */
    duration?: number;
    /** Step for Page Up/Page Down and Shift + arrow keys. Defaults to a tenth of `duration`. */
    largeStep?: number;
    /** Fires while seeking: press, drag, keyboard and input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when a seek that moved the position ends. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** Amplitudes of the audio, 0…1 each, at any resolution: the canvas fits them to its width. */
    peaks?: ArrayLike<number>;
    /** A live position followed outside React; takes precedence over `value`. */
    source?: Source;
    /** Step for the arrow keys. Defaults to a hundredth of `duration`. */
    step?: number;
    /** Playback position, from 0 to `duration`. */
    value?: number;
  }
}

interface SeekGesture {
  /** Whether the gesture moved the position at least once; if so its end commits. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
}

/**
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * tracks the hovered position for `Waveform.Hover`, sets `touch-action: none`
 * so touch scrubbing doesn't scroll the page, and holds the native
 * `<input type="range">` that takes focus, handles the keyboard and carries
 * the accessible name (`aria-label` / `aria-labelledby`).
 * Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useWaveformContext("Control");
  const { duration } = meta;
  const gestureRef = React.useRef<SeekGesture | null>(null);
  const describe = getAriaValueText ?? describeAsPercent;
  // Kept current for the paints that happen outside React.
  meta.describeRef.current = describe;

  const valueAt = (event: React.PointerEvent<HTMLDivElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      clampUnit((event.clientX - rect.left) / Math.max(rect.width, 1)) *
      duration
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    meta.inputRef.current?.focus({ preventScroll: true });
    const gesture: SeekGesture = {
      changed: false,
      moved: false,
      pointerId: event.pointerId,
    };
    gestureRef.current = gesture;
    actions.setDragging(true);
    gesture.changed = actions.change(
      valueAt(event),
      createChangeEventDetails("press", event.nativeEvent)
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled) {
      return;
    }
    const at = valueAt(event);
    meta.hover.set(at);
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gesture.moved = true;
    if (
      actions.change(at, createChangeEventDetails("drag", event.nativeEvent))
    ) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the position falls back to the known value after.
    const committed = meta.valueRef.current;
    actions.setDragging(false);
    if (gesture.changed) {
      actions.commit(committed, {
        event: event.nativeEvent,
        reason: gesture.moved ? "drag" : "press",
      });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (state.disabled) {
        return;
      }
      const { current } = meta.valueRef;
      const arrowStep = event.shiftKey ? meta.largeStep : meta.step;
      const targets: Record<string, number> = {
        ArrowDown: current - arrowStep,
        ArrowLeft: current - arrowStep,
        ArrowRight: current + arrowStep,
        ArrowUp: current + arrowStep,
        End: duration,
        Home: 0,
        PageDown: current - meta.largeStep,
        PageUp: current + meta.largeStep,
      };
      const next = targets[event.key];
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      const native = event.nativeEvent;
      if (actions.change(next, createChangeEventDetails("keyboard", native))) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "keyboard",
        });
      }
    },
    [actions, duration, meta, state.disabled]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      if (
        actions.change(
          Number(event.currentTarget.value),
          createChangeEventDetails("input-change", native)
        )
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, meta]
  );

  const initialValue = meta.valueRef.current;

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={describe(initialValue, duration)}
              defaultValue={initialValue}
              disabled={state.disabled}
              max={duration}
              min={0}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={meta.inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
            />
          </>
        ),
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerLeave: () => meta.hover.set(null),
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Control {
  export type State = Root.State;
  export interface Props extends PartProps<"div", State> {
    /** Returns how the position is announced, e.g. `"0:12 of 1:42"`. Defaults to the played share, e.g. `"30%"`. */
    getAriaValueText?: (value: number, duration: number) => string;
  }
}

/**
 * Draws the peaks as bars on a canvas: sharp at any pixel density, as many
 * bars as fit its width, the played part in one color and the rest in another.
 * It repaints only when the position, the size, the peaks or the theme change.
 *
 * Colors come from CSS: `--waveform-color` and `--waveform-progress-color`
 * (both default to the text color). The bar corner radius is `barRadius`, or
 * the `--waveform-bar-radius` CSS length. Renders a `<canvas>` element.
 */
export function Canvas(componentProps: Canvas.Props) {
  const {
    barGap = 2,
    barRadius,
    barWidth = 3,
    className,
    ref,
    render,
    style,
    variant = "mirror",
    ...elementProps
  } = componentProps;
  const { meta, state } = useWaveformContext("Canvas");
  const { peaks, position } = meta;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!(canvas && context)) {
      return;
    }
    registerBarRadiusProperty();

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let levels: Float32Array = new Float32Array(0);
    let frame = 0;

    const fillBars = (
      color: string,
      from: number,
      to: number,
      radius: number
    ) => {
      if (to <= from) {
        return;
      }
      context.save();
      context.beginPath();
      context.rect(from, 0, to - from, height);
      context.clip();
      context.fillStyle = color;
      for (let index = 0; index < levels.length; index += 1) {
        const bar = barRect(levels[index] ?? 0, index, {
          barGap,
          barWidth,
          height,
          variant,
        });
        context.globalAlpha = bar.alpha;
        context.beginPath();
        if (radius > 0 && typeof context.roundRect === "function") {
          context.roundRect(
            bar.x,
            bar.y,
            bar.width,
            bar.height,
            Math.min(radius, bar.width / 2, bar.height / 2)
          );
        } else {
          context.rect(bar.x, bar.y, bar.width, bar.height);
        }
        context.fill();
      }
      context.restore();
    };

    const draw = () => {
      frame = 0;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (width === 0 || height === 0) {
        return;
      }
      const computed = getComputedStyle(canvas);
      const color =
        computed.getPropertyValue("--waveform-color").trim() || computed.color;
      const progressColor =
        computed.getPropertyValue("--waveform-progress-color").trim() || color;
      const radius =
        barRadius ??
        (Number.parseFloat(computed.getPropertyValue(BAR_RADIUS_PROPERTY)) ||
          0);
      // The two passes never overlap, so translucent bars keep their own color.
      const playedWidth = position.get() * width;
      fillBars(color, playedWidth, width, radius);
      fillBars(progressColor, 0, playedWidth, radius);
    };

    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(draw);
      }
    };

    const measure = () => {
      ({ height, width } = canvas.getBoundingClientRect());
      pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      levels = resamplePeaks(peaks ?? [], barCount(width, barWidth, barGap));
      schedule();
    };

    measure();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resizeObserver?.observe(canvas);
    // Colors are read from CSS at paint time: repaint when the theme flips.
    const themeObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(schedule);
    themeObserver?.observe(document.documentElement, {
      attributeFilter: THEME_ATTRIBUTES,
      attributes: true,
    });
    const unsubscribe = position.subscribe(schedule);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      unsubscribe();
    };
  }, [barGap, barRadius, barWidth, peaks, position, variant]);

  return useRender({
    defaultTagName: "canvas",
    props: mergeProps<"canvas">(
      { "aria-hidden": true },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, canvasRef] : canvasRef,
    render,
    state,
  });
}

export namespace Canvas {
  export type State = Root.State;
  export interface Props extends PartProps<"canvas", State> {
    /** Space between bars, in CSS pixels. @default 2 */
    barGap?: number;
    /** Bar corner radius, in CSS pixels. Defaults to the `--waveform-bar-radius` CSS length. */
    barRadius?: number;
    /** Bar width, in CSS pixels. @default 3 */
    barWidth?: number;
    /** `mirror` centers the bars on the middle line; `bars` stands them on the baseline. @default "mirror" */
    variant?: WaveformVariant;
  }
}

/**
 * A marker at the playback position, with no interaction of its own.
 * Renders a `<div>` element.
 */
export function Playhead(componentProps: Playhead.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useWaveformContext("Playhead");
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: { left: `var(${POSITION_PROPERTY})`, position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Playhead {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}

/**
 * A handle centered on the playback position. Renders a `<div>` element.
 */
export function Thumb(componentProps: Thumb.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useWaveformContext("Thumb");
  const resolved = resolveStyling(className, style, state);
  // Centering stays in `transform` so `translate` remains free for styling.
  const baseTransform = "translateX(-50%)";
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { "aria-hidden": true },
      {
        ...elementProps,
        className: resolved.className,
        style: {
          left: `var(${POSITION_PROPERTY})`,
          position: "absolute",
          ...resolved.style,
          transform: resolved.style?.transform
            ? `${baseTransform} ${resolved.style.transform}`
            : baseTransform,
        },
      }
    ),
    ref,
    render,
    state,
  });
}

export namespace Thumb {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}

/**
 * Shown while the pointer is over the `Control`, positioned at the hovered
 * point. Its children receive the hovered position, to print a time.
 * Renders a `<div>` element.
 */
export function Hover(componentProps: Hover.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = useWaveformContext("Hover");
  const { duration, hover } = meta;
  const hovered = React.useSyncExternalStore(
    hover.subscribe,
    hover.get,
    hover.get
  );
  const fraction = hovered !== null && duration > 0 ? hovered / duration : 0;
  return useRender({
    defaultTagName: "div",
    enabled: hovered !== null && !state.disabled,
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        children:
          typeof children === "function" ? children(hovered ?? 0) : children,
        style: { left: `${fraction * 100}%`, position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Hover {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    children?: React.ReactNode | ((value: number) => React.ReactNode);
  }
}
