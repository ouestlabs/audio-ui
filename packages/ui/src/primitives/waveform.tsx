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

/**
 * A seekable waveform — the interaction half of the pairing waveform-path
 * (https://github.com/jerosoler/waveform-path) and wave-audio-path-player
 * (https://github.com/jerosoler/wave-audio-path-player) popularized: drag
 * (or click) anywhere along the track to seek, the same left-to-right value
 * model as `Fader` in its horizontal orientation. The actual waveform shape
 * is a plain `d` string a consumer supplies to `Path`/`Progress` — this
 * primitive has no opinion on how that shape was generated (audio
 * samples, a placeholder curve, anything), the same way `PianoRoll` has no
 * opinion on where its notes came from.
 */
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

  /** Purely a rendering surface for `Path`/`Progress` — its `viewBox` should match whatever `width`/`height` the consumer generated the waveform path against. Interaction lives on the enclosing `Track`, not here. */
  export function Svg({ className, ...props }: SvgProps) {
    const { disabled } = useWaveformConfigContext();
    return (
      <svg
        aria-hidden="true"
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "svg" })}
        preserveAspectRatio="none"
        style={{ display: "block", pointerEvents: "none", width: "100%" }}
        {...props}
      />
    );
  }

  export interface PathProps extends React.ComponentProps<"path"> {
    d: string;
  }

  /** The full waveform shape, purely decorative — the shape a consumer generated (from real audio samples, a placeholder curve, anything) and passed as `d`. */
  export function Path({ className, ...props }: PathProps) {
    const { disabled } = useWaveformConfigContext();
    return (
      <path
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "path" })}
        {...props}
      />
    );
  }

  export interface ProgressProps extends React.ComponentProps<"path"> {
    d: string;
  }

  /** The same waveform shape as `Path`, clipped to reveal only the portion up to the current value — the "played" half of the two-path technique wave-audio-path-player uses. */
  export function Progress({ className, style, ...props }: ProgressProps) {
    const { disabled } = useWaveformConfigContext();
    const { percentage } = useWaveformValueContext();

    return (
      <path
        className={className}
        {...getDataAttributes("waveform", { disabled, part: "progress" })}
        style={{
          clipPath: `inset(0 ${(1 - percentage) * 100}% 0 0)`,
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
