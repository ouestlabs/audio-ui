import type { Nullable, Point, Procedure } from "@audio-ui/utils";
import { clampUnit } from "@audio-ui/utils";
import * as React from "react";
import { useFocus } from "../hooks/interactions/use-focus";
import { usePointerDrag } from "../hooks/interactions/use-pointer-drag";
import { getDataAttributes } from "./internal/data-attributes";
import {
  type UseParameterDragCallbacks,
  useParameter,
} from "./internal/use-parameter";

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 1;
/** Fine enough to read as a continuous seek rather than a stepped one, while still keyed off the same quantize/step machinery every other primitive uses. */
const DEFAULT_STEP = 0.001;

interface WaveformConfigContextValue {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disabled: boolean;
  dragCallbacks: UseParameterDragCallbacks;
  elementId: string;
  keyboardProps: { onKeyDown: Procedure<React.KeyboardEvent> };
  max: number;
  min: number;
  shouldPreventFocusRef: React.RefObject<boolean>;
  thumbRef: React.RefObject<Nullable<HTMLDivElement>>;
  trackRef: React.RefObject<Nullable<HTMLDivElement>>;
}

/** Split from config: changes every drag frame, so only components that render live position subscribe to it. */
interface WaveformValueContextValue {
  percentage: number;
  value: number;
}

const WaveformConfigContext =
  React.createContext<WaveformConfigContextValue | null>(null);
const WaveformValueContext =
  React.createContext<WaveformValueContextValue | null>(null);

function useWaveformConfigContext() {
  const context = React.useContext(WaveformConfigContext);
  if (!context) {
    throw new Error("Waveform components must be used within Waveform.Root");
  }
  return context;
}

function useWaveformValueContext() {
  const context = React.useContext(WaveformValueContext);
  if (!context) {
    throw new Error("Waveform components must be used within Waveform.Root");
  }
  return context;
}

export namespace Waveform {
  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      "onChange" | "defaultValue" | "min" | "max" | "step" | "value"
    > {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: number;
    disabled?: boolean;
    /** Upper bound of the seek value — defaults to a 0-1 fraction, or pass e.g. a track's duration in seconds. */
    max?: number;
    min?: number;
    onValueChange?: Procedure<number>;
    onValueCommit?: Procedure<number>;
    step?: number;
    value?: number;
  }

  export function Root({
    value: controlledValue,
    defaultValue,
    min = DEFAULT_MIN,
    max = DEFAULT_MAX,
    step = DEFAULT_STEP,
    disabled = false,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    style,
    children,
    ...props
  }: RootProps) {
    const rootId = React.useId();
    const trackRef = React.useRef<HTMLDivElement>(null);
    const thumbRef = React.useRef<HTMLDivElement>(null);

    const calculateValueFromPoint = React.useCallback(
      (point: Point): Nullable<number> => {
        const track = trackRef.current;
        if (!track) {
          return null;
        }
        const rect = track.getBoundingClientRect();
        if (rect.width <= 0) {
          return null;
        }
        const percentage = clampUnit((point.x - rect.left) / rect.width);
        return min + percentage * (max - min);
      },
      [min, max]
    );

    const calculateValueFromDelta = React.useCallback(
      (delta: Point, initialValue: number) => {
        const track = trackRef.current;
        if (!track) {
          return initialValue;
        }
        const rect = track.getBoundingClientRect();
        const sensitivity = (max - min) / Math.max(rect.width, 1);
        return initialValue + delta.x * sensitivity;
      },
      [min, max]
    );

    const containsTarget = React.useCallback(
      (target: Node) =>
        Boolean(
          thumbRef.current?.contains(target) ||
            trackRef.current?.contains(target)
        ),
      []
    );

    const {
      dragCallbacks,
      keyboardProps,
      percentage,
      shouldPreventFocusRef,
      value,
    } = useParameter({
      containsTarget,
      defaultValue,
      deltaToValue: calculateValueFromDelta,
      disabled,
      focusRef: thumbRef,
      max,
      min,
      onValueChange,
      onValueCommit,
      pointToValue: calculateValueFromPoint,
      step,
      value: controlledValue,
    });

    const elementId = id || rootId;

    const configValue = React.useMemo<WaveformConfigContextValue>(
      () => ({
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragCallbacks,
        elementId,
        keyboardProps,
        max,
        min,
        shouldPreventFocusRef,
        thumbRef,
        trackRef,
      }),
      [
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragCallbacks,
        elementId,
        keyboardProps,
        max,
        min,
        shouldPreventFocusRef,
      ]
    );

    const valueContextValue = React.useMemo<WaveformValueContextValue>(
      () => ({ percentage, value }),
      [percentage, value]
    );

    return (
      <WaveformConfigContext.Provider value={configValue}>
        <WaveformValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("waveform", {
              disabled,
              part: "waveform-wrapper",
            })}
            style={{ position: "relative", ...style }}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Waveform
              </span>
            )}
            {children}
          </div>
        </WaveformValueContext.Provider>
      </WaveformConfigContext.Provider>
    );
  }

  export interface TrackProps extends React.ComponentProps<"div"> {}

  /** The interactive hit-area — click or drag anywhere on it to seek. Wraps `Svg` (and whatever else) the same way `Fader.Track` wraps `Fader.Range`; kept as a plain `div` rather than putting pointer handling on the `<svg>` itself since SVG elements sit outside the `HTMLElement` hierarchy `usePointerDrag` targets. */
  export function Track({ className, ...props }: TrackProps) {
    const { disabled, dragCallbacks, trackRef } = useWaveformConfigContext();

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: trackRef,
      ...dragCallbacks,
    });

    return (
      <div
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "track" })}
        ref={trackRef}
        style={{ position: "relative", touchAction: "none" }}
        {...pointerProps}
        {...props}
      />
    );
  }

  export interface SvgProps
    extends Omit<React.ComponentProps<"svg">, "viewBox"> {
    viewBox?: string;
  }

  /** Purely a rendering surface for `Bars`/`BarsProgress` — its `viewBox` should match the coordinate space the consumer laid the bars out in. Interaction lives on the enclosing `Track`, not here. */
  export function Svg({ className, ...props }: SvgProps) {
    const { disabled } = useWaveformConfigContext();
    return (
      <svg
        aria-hidden="true"
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "svg" })}
        preserveAspectRatio="none"
        style={{
          display: "block",
          height: "100%",
          pointerEvents: "none",
          width: "100%",
        }}
        {...props}
      />
    );
  }

  export interface WaveformBarValue {
    height: number;
    opacity?: number;
    width: number;
    x: number;
    y: number;
  }

  function renderBarRects(
    bars: WaveformBarValue[],
    radius: number,
    className: string | undefined
  ) {
    return bars.map((bar) => (
      <rect
        className={className}
        fillOpacity={bar.opacity}
        height={bar.height}
        key={bar.x}
        rx={radius}
        width={bar.width}
        x={bar.x}
        y={bar.y}
      />
    ));
  }

  export interface BarsProps
    extends Omit<React.ComponentProps<"g">, "children" | "className"> {
    bars: WaveformBarValue[];
    className?: string;
    radius?: number;
  }

  /** The full waveform shape as discrete bars, purely decorative — each bar's position/size/opacity a consumer computed (from real audio samples, a placeholder curve, anything) and passed in, the same "no opinion on the data" split `Path` uses for a continuous line. */
  export function Bars({ bars, radius = 0, className, ...props }: BarsProps) {
    const { disabled } = useWaveformConfigContext();
    return (
      <g
        {...getDataAttributes("waveform", { disabled, part: "bars" })}
        {...props}
      >
        {renderBarRects(bars, radius, className)}
      </g>
    );
  }

  export interface BarsProgressProps extends BarsProps {}

  /** The same bars as `Bars`, clipped to reveal only the portion up to the current value — the bar-chart equivalent of `Progress`. */
  export function BarsProgress({
    bars,
    radius = 0,
    className,
    style,
    ...props
  }: BarsProgressProps) {
    const { disabled } = useWaveformConfigContext();
    const { percentage } = useWaveformValueContext();

    return (
      <g
        {...getDataAttributes("waveform", { disabled, part: "bars-progress" })}
        style={{
          clipPath: `inset(0 ${(1 - percentage) * 100}% 0 0)`,
          ...style,
        }}
        {...props}
      >
        {renderBarRects(bars, radius, className)}
      </g>
    );
  }

  export interface PlayheadProps extends React.ComponentProps<"div"> {}

  /** A purely decorative marker at the current value's position — unlike `Thumb`, carries no interaction or ARIA semantics of its own, for when a consumer wants a visual echo of the position (a line, a glow, anything) alongside the actual `Thumb`. */
  export function Playhead({ className, style, ...props }: PlayheadProps) {
    const { disabled } = useWaveformConfigContext();
    const { percentage } = useWaveformValueContext();

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "playhead" })}
        style={{
          left: `${percentage * 100}%`,
          pointerEvents: "none",
          position: "absolute",
          ...style,
        }}
        {...props}
      />
    );
  }

  export interface ThumbProps extends React.ComponentProps<"div"> {}

  export function Thumb({ className, style, ...props }: ThumbProps) {
    const {
      ariaLabel,
      ariaLabelledBy,
      disabled,
      dragCallbacks,
      elementId,
      keyboardProps,
      max,
      min,
      shouldPreventFocusRef,
      thumbRef,
    } = useWaveformConfigContext();
    const { percentage, value } = useWaveformValueContext();

    const { pointerProps: thumbPointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: thumbRef,
      ...dragCallbacks,
    });

    const { focusProps } = useFocus({
      disabled,
      onFocus: () => {
        if (shouldPreventFocusRef.current) {
          shouldPreventFocusRef.current = false;
        }
      },
    });

    return (
      <div
        aria-disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "thumb" })}
        ref={thumbRef}
        role="slider"
        style={{
          left: `${percentage * 100}%`,
          position: "absolute",
          transform: "translateX(-50%)",
          ...style,
        }}
        {...keyboardProps}
        {...thumbPointerProps}
        {...focusProps}
        onFocus={(e) => {
          if (shouldPreventFocusRef.current) {
            shouldPreventFocusRef.current = false;
          }
          focusProps.onFocus(e);
        }}
        tabIndex={disabled ? -1 : focusProps.tabIndex}
        {...props}
      />
    );
  }
}
