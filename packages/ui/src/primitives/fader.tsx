import { Slider } from "@base-ui/react/slider";
import * as React from "react";
import { useWheel } from "../hooks/interactions/use-wheel";
import { clamp, type Nullable, type Point } from "../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "./internal/event-details";

const DEFAULT_MIN = -60;
const DEFAULT_MAX = 6;
const WHEEL_DELTA_EPSILON = 0.1;

interface FaderContextValue {
  wheelRef: (node: Nullable<HTMLElement>) => void;
}

const FaderContext = React.createContext<FaderContextValue | null>(null);

function useFaderContext(part: string): FaderContextValue {
  const context = React.use(FaderContext);
  if (!context) {
    throw new Error(`Fader.${part} must be used within Fader.Root`);
  }
  return context;
}

/** Snap to `step` with `min` as the origin, without float noise (0.1 + 0.2). */
function roundToStep(value: number, step: number, min: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(
    (Math.round((value - min) / step) * step + min).toFixed(decimals)
  );
}

/**
 * Groups all parts of the fader: a Base UI `Slider.Root` with audio defaults
 * (vertical, -60…+6), mouse-wheel stepping, and `freezeWhileDragging`.
 * Renders a `<div>` element.
 */
export function Root({
  defaultValue,
  disabled = false,
  freezeWhileDragging = false,
  max = DEFAULT_MAX,
  min = DEFAULT_MIN,
  onValueChange,
  onValueCommitted,
  orientation = "vertical",
  step = 1,
  value: valueProp,
  ...props
}: Root.Props) {
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    () => defaultValue ?? min + (max - min) / 2
  );
  const value = isControlled ? valueProp : uncontrolledValue;

  // Holds the dragged value until the pointer is released, so a controlled
  // value that lags behind (playback time) can't pull the thumb back.
  const [dragValue, setDragValue] = React.useState<number | null>(null);
  const isFrozen = dragValue !== null;
  React.useEffect(() => {
    if (!isFrozen) {
      return;
    }
    const release = () => setDragValue(null);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [isFrozen]);
  const displayedValue = dragValue ?? value;

  const handleValueChange = React.useCallback(
    (next: number, eventDetails: Root.ChangeEventDetails) => {
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (
        freezeWhileDragging &&
        (eventDetails.reason === "drag" ||
          eventDetails.reason === "track-press")
      ) {
        setDragValue(next);
      }
    },
    [freezeWhileDragging, isControlled, onValueChange]
  );

  const handleValueCommitted = React.useCallback(
    (next: number, eventDetails: Root.CommitEventDetails) => {
      setDragValue(null);
      onValueCommitted?.(next, eventDetails);
    },
    [onValueCommitted]
  );

  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  const { wheelRef } = useWheel({
    disabled,
    onWheel: (event: WheelEvent, delta: Point) => {
      if (Math.abs(delta.y) < WHEEL_DELTA_EPSILON) {
        return;
      }
      const { current } = valueRef;
      const next = clamp(
        roundToStep(current + (delta.y < 0 ? step : -step), step, min),
        min,
        max
      );
      if (next === current) {
        return;
      }
      const changeDetails = Object.assign(
        createChangeEventDetails("wheel", event),
        { activeThumbIndex: 0 }
      );
      onValueChange?.(next, changeDetails);
      if (changeDetails.isCanceled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueCommitted?.(next, { event, reason: "wheel" });
    },
  });

  const contextValue = React.useMemo(() => ({ wheelRef }), [wheelRef]);

  return (
    <FaderContext value={contextValue}>
      <Slider.Root
        {...props}
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={handleValueChange}
        onValueCommitted={handleValueCommitted}
        orientation={orientation}
        step={step}
        value={displayedValue}
      />
    </FaderContext>
  );
}

export namespace Root {
  export type State = Slider.Root.State;
  export type ChangeEventReason = Slider.Root.ChangeEventReason | "wheel";
  export type ChangeEventDetails =
    | Slider.Root.ChangeEventDetails
    | (ExtraChangeEventDetails<"wheel", WheelEvent> & {
        activeThumbIndex: number;
      });
  export type CommitEventReason = Slider.Root.CommitEventReason | "wheel";
  export type CommitEventDetails =
    | Slider.Root.CommitEventDetails
    | ExtraCommitEventDetails<"wheel", WheelEvent>;

  export interface Props
    extends Omit<
      Slider.Root.Props<number>,
      | "defaultValue"
      | "max"
      | "min"
      | "onValueChange"
      | "onValueCommitted"
      | "orientation"
      | "value"
    > {
    /** Uncontrolled starting value; defaults to the midpoint of `min…max`. */
    defaultValue?: number;
    /**
     * Keep the thumb on the dragged position while a controlled `value` lags
     * behind (e.g. a seek bar driven by playback time).
     * @default false
     */
    freezeWhileDragging?: boolean;
    /** @default 6 */
    max?: number;
    /** @default -60 */
    min?: number;
    /** Fires on drag, track press, keyboard, wheel and form input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** @default "vertical" */
    orientation?: "horizontal" | "vertical";
    value?: number;
  }
}

/**
 * The interactive area: pointer presses and drags, plus mouse-wheel stepping.
 * Sets `touch-action: none` so touch drags don't scroll the page.
 * Renders a `<div>` element.
 */
export function Control({ ref, style, ...props }: Control.Props) {
  const { wheelRef } = useFaderContext("Control");
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      wheelRef(node);
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref, wheelRef]
  );
  const controlStyle: Control.Props["style"] =
    typeof style === "function"
      ? (state) => ({ touchAction: "none", ...style(state) })
      : { touchAction: "none", ...style };

  return <Slider.Control {...props} ref={setRef} style={controlStyle} />;
}

export namespace Control {
  export type Props = Slider.Control.Props & {
    ref?: React.Ref<HTMLDivElement>;
  };
  export type State = Slider.Control.State;
}

/** Accessible label, associated with the thumb. Renders a `<div>` element. */
export const { Label } = Slider;
export namespace Label {
  export type Props = Slider.Label.Props;
  export type State = Slider.Label.State;
}

/** The formatted value (`format`/`locale` on Root). Renders an `<output>` element. */
export const { Value } = Slider;
export namespace Value {
  export type Props = Slider.Value.Props;
  export type State = Slider.Value.State;
}

/** The full range of travel. Renders a `<div>` element. */
export const { Track } = Slider;
export namespace Track {
  export type Props = Slider.Track.Props;
  export type State = Slider.Track.State;
}

/** The filled part of the track, up to the value. Renders a `<div>` element. */
export const { Indicator } = Slider;
export namespace Indicator {
  export type Props = Slider.Indicator.Props;
  export type State = Slider.Indicator.State;
}

/**
 * The draggable thumb, with a nested `<input type="range">` that carries the
 * accessible name (`aria-label`/`aria-labelledby`) and form value.
 * Renders a `<div>` element.
 */
export const { Thumb } = Slider;
export namespace Thumb {
  export type Props = Slider.Thumb.Props;
  export type State = Slider.Thumb.State;
}
