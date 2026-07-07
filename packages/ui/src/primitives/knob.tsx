import {
  clamp,
  degToRad,
  type Nullable,
  PI_HALF,
  type Point,
  type Procedure,
  panic,
  quantizeRound,
  radToDeg,
  TAU,
} from "@audio-ui/utils";
import * as React from "react";
import {
  useFocus,
  useKeyboardNavigation,
  usePointerDrag,
  useWheel,
} from "../hooks/interactions";
import { useControlledValue, useValueAsRef } from "../hooks/state";
import { getDataAttributes } from "./internal/data-attributes";

const KNOB_VIEWBOX_CX = 24;
const KNOB_VIEWBOX_CY = 24;

/** Drag: lock pan only after clear vertical intent; rotation stays the default. */
const KNOB_DRAG_PAN_MIN_VERTICAL_PX = 10;
const KNOB_DRAG_PAN_DOMINANCE_RATIO = 2.5;
const KNOB_DRAG_MODE_LOCK_MIN_PX = 6;
const KNOB_DRAG_MODE_LOCK_REL = 0.055;
/** Fraction of knob diameter — inside this radius, sync angle only (no value jump when crossing the hub). */
const KNOB_DRAG_CENTER_DEAD_ZONE_REL = 0.08;
const KNOB_DRAG_CENTER_DEAD_ZONE_MIN_PX = 2;
const KNOB_DRAG_PAN_SENSITIVITY_DIVISOR = 150;
/** With `KNOB_DOUBLE_TAP_MAX_MOVE_PX`, two quick tap-style pointer-ups reset the value to `defaultValue` (or midpoint). */
const KNOB_DOUBLE_TAP_MAX_MS = 320;
const KNOB_DOUBLE_TAP_MAX_MOVE_PX = 12;

/** Outer arc geometry in the 48×48 viewBox; track is inset so the ring sits beyond the face. */
const KNOB_DEFAULT_ARC_RADIUS = 23;
const KNOB_DEFAULT_ARC_STROKE = 3;
const KNOB_DEFAULT_ANGLE_GAP_RAD = Math.PI / 5;
const KNOB_DEFAULT_INDICATOR_SPAN = [0.24, 0.58] as const;
const KNOB_DEFAULT_INDICATOR_WIDTH = 2.75;

function knobAnglesFromBottomGap(gapRad: number): {
  angleOffsetDeg: number;
  angleRangeDeg: number;
} {
  if (gapRad <= 0 || gapRad >= PI_HALF) {
    panic(`angle gap must be in (0, PI_HALF), got ${gapRad}`);
  }
  return {
    angleOffsetDeg: 90.0 + radToDeg(PI_HALF + gapRad),
    angleRangeDeg: radToDeg(TAU - 2.0 * gapRad),
  };
}

function knobTrackRadius(arcRadius: number, strokeWidth: number): number {
  return Math.max(0.5, arcRadius - strokeWidth * 0.5);
}

function knobPolarRad(
  angleOffsetDeg: number,
  angleRangeDeg: number,
  t: number
): number {
  return degToRad(angleOffsetDeg + t * angleRangeDeg - 90);
}

/** Arc along the value track between two normalized positions `t0` and `t1` (0…1). */
function knobArcAlongTrack(
  trackRadius: number,
  angleOffsetDeg: number,
  angleRangeDeg: number,
  t0: number,
  t1: number
): string {
  const r0 = knobPolarRad(angleOffsetDeg, angleRangeDeg, t0);
  const r1 = knobPolarRad(angleOffsetDeg, angleRangeDeg, t1);
  const x0 = KNOB_VIEWBOX_CX + trackRadius * Math.cos(r0);
  const y0 = KNOB_VIEWBOX_CY + trackRadius * Math.sin(r0);
  const x1 = KNOB_VIEWBOX_CX + trackRadius * Math.cos(r1);
  const y1 = KNOB_VIEWBOX_CY + trackRadius * Math.sin(r1);
  const spanRad = degToRad(angleRangeDeg) * (t1 - t0);
  const largeArc = Math.abs(spanRad) > Math.PI ? 1 : 0;
  const sweep = spanRad >= 0 ? 1 : 0;
  return `M ${x0} ${y0} A ${trackRadius} ${trackRadius} 0 ${largeArc} ${sweep} ${x1} ${y1}`;
}

interface KnobContextValue {
  anchorPercentage: number;
  angleOffset: number;
  angleRange: number;
  arcStrokeWidth: number;
  arcTrackRadius: number;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  commitValue: Procedure<number>;
  disabled: boolean;
  elementId: string;
  indicatorSpan: readonly [number, number];
  indicatorWidth: number;
  knobRef: React.RefObject<Nullable<HTMLDivElement>>;
  max: number;
  min: number;
  onDrag: (e: React.PointerEvent, delta: Point) => void;
  onDragEnd: Procedure<React.PointerEvent>;
  onDragStart: Procedure<React.PointerEvent>;
  onPointerDown: (e: React.PointerEvent) => void;
  onValueCommit?: Procedure<number>;
  percentage: number;
  rotation: number;
  setRawValue: Procedure<number>;
  shouldPreventFocusRef: React.RefObject<boolean>;
  step: number;
  updateValue: Procedure<number>;
  value: number;
  valueRef: React.RefObject<number>;
  wheelRef: Procedure<Nullable<HTMLDivElement>>;
}

const KnobContext = React.createContext<KnobContextValue | null>(null);

function useKnobContext() {
  const context = React.useContext(KnobContext);
  if (!context) {
    panic("Knob components must be used within Knob.Root");
  }
  return context;
}

export namespace Knob {
  /**
   * Rotational drag scaling.
   * - `arc` — pointer travel along {@link RootProps.angleRange | angleRange} maps to `min…max` (default, audio-style).
   * - `revolution` — one full 360° around the center maps to `min…max` (continuous / html5-knob style).
   */
  export type DragSensitivity = "arc" | "revolution";

  /**
   * Optional pointer-drag tuning (dead zone, vertical pan, pan-vs-rotate thresholds).
   * Omitted fields use built-in defaults. {@link RootProps.dragSensitivity | dragSensitivity} only affects arc vs full-turn value scaling, not these gestures.
   */
  export type DragOptions = Readonly<{
    /**
     * When `true`, a mostly-vertical drag can behave like a fader (`(max-min)/panSensitivityDivisor` per step).
     * Default `false` for both `arc` and `revolution` — circular drag only.
     */
    verticalPanEnabled?: boolean;
    /**
     * Vertical pan: value change per unit of pointer vertical delta is `(max - min) / panSensitivityDivisor`.
     * Default `150`.
     */
    panSensitivityDivisor?: number;
    /**
     * Around the knob center, angle is synced but not accumulated — avoids spikes when crossing the hub.
     * Radius ≈ `max(centerDeadZoneMinPx, min(width,height) * centerDeadZoneRel)`.
     */
    centerDeadZoneRel?: number;
    /** Default `2` (px). */
    centerDeadZoneMinPx?: number;
    /** Movement (px) before pan vs rotate is decided. Default `6`. */
    modeLockMinPx?: number;
    /** Combined with knob size: `threshold = max(modeLockMinPx, minDim * modeLockRel)`. Default `0.055`. */
    modeLockRel?: number;
    /** Pan is allowed only if vertical movement exceeds this (px). Default `10`. */
    panMinVerticalPx?: number;
    /** Pan only if `movedY > movedX * panDominanceRatio`. Default `2.5`. */
    panDominanceRatio?: number;
  }>;

  type ResolvedDragConfig = {
    verticalPanEnabled: boolean;
    panSensitivityDivisor: number;
    centerDeadZoneRel: number;
    centerDeadZoneMinPx: number;
    modeLockMinPx: number;
    modeLockRel: number;
    panMinVerticalPx: number;
    panDominanceRatio: number;
  };

  function resolvedDragConfig(partial?: DragOptions): ResolvedDragConfig {
    const base: ResolvedDragConfig = {
      centerDeadZoneMinPx: KNOB_DRAG_CENTER_DEAD_ZONE_MIN_PX,
      centerDeadZoneRel: KNOB_DRAG_CENTER_DEAD_ZONE_REL,
      modeLockMinPx: KNOB_DRAG_MODE_LOCK_MIN_PX,
      modeLockRel: KNOB_DRAG_MODE_LOCK_REL,
      panDominanceRatio: KNOB_DRAG_PAN_DOMINANCE_RATIO,
      panMinVerticalPx: KNOB_DRAG_PAN_MIN_VERTICAL_PX,
      panSensitivityDivisor: KNOB_DRAG_PAN_SENSITIVITY_DIVISOR,
      verticalPanEnabled: false,
    };
    if (!partial) {
      return base;
    }
    return {
      ...base,
      ...Object.fromEntries(
        Object.entries(partial).filter((entry) => entry[1] !== undefined)
      ),
    } as ResolvedDragConfig;
  }

  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      | "onChange"
      | "onInput"
      | "type"
      | "value"
      | "defaultValue"
      | "min"
      | "max"
      | "step"
    > {
    anchor?: number;
    /** Bottom gap in radians (`0 … π/2`); sets sweep when paired with defaults. Ignored if you rely only on `angleOffset`/`angleRange`. */
    angleGapRad?: number;
    angleOffset?: number;
    angleRange?: number;
    /** ViewBox geometry (48×48 space). Sensible defaults are built in; override only when needed. */
    arcRadius?: number;
    arcStrokeWidth?: number;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: number;
    disabled?: boolean;
    /** Fine-tune pan vs rotate, dead zone, and vertical sensitivity. */
    dragOptions?: DragOptions;
    /** How pointer rotation maps to value; default `arc`. */
    dragSensitivity?: DragSensitivity;
    indicatorSpan?: readonly [number, number];
    indicatorWidth?: number;
    max?: number;
    min?: number;
    onValueChange?: Procedure<number>;
    onValueCommit?: Procedure<number>;
    step?: number;
    value?: number;
  }

  /**
   * Rotary control with drag, wheel, and keyboard. Two quick taps (double-click / double-tap) with little pointer movement reset to {@link RootProps.defaultValue | defaultValue} (clamped and stepped); if `defaultValue` is omitted, the midpoint between `min` and `max` is used.
   */
  export function Root({
    value: controlledValue,
    defaultValue = 0,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    anchor,
    angleRange: angleRangeProp,
    angleOffset: angleOffsetProp,
    arcRadius: arcRadiusProp,
    arcStrokeWidth: arcStrokeWidthProp,
    angleGapRad: angleGapRadProp,
    indicatorSpan: indicatorSpanProp,
    indicatorWidth: indicatorWidthProp,
    dragSensitivity = "arc",
    dragOptions,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    children,
    ...props
  }: RootProps) {
    const knobId = React.useId();
    const knobRef = React.useRef<HTMLDivElement>(null);

    const gapAngles = knobAnglesFromBottomGap(
      angleGapRadProp ?? KNOB_DEFAULT_ANGLE_GAP_RAD
    );
    const angleOffset = angleOffsetProp ?? gapAngles.angleOffsetDeg;
    const angleRange = angleRangeProp ?? gapAngles.angleRangeDeg;
    const arcStrokeWidth = arcStrokeWidthProp ?? KNOB_DEFAULT_ARC_STROKE;
    const arcTrackRadius = knobTrackRadius(
      arcRadiusProp ?? KNOB_DEFAULT_ARC_RADIUS,
      arcStrokeWidth
    );
    const indicatorSpan: readonly [number, number] = indicatorSpanProp
      ? [indicatorSpanProp[0], indicatorSpanProp[1]]
      : KNOB_DEFAULT_INDICATOR_SPAN;
    const indicatorWidth = indicatorWidthProp ?? KNOB_DEFAULT_INDICATOR_WIDTH;

    const computedDefaultValue =
      defaultValue ?? (max < min ? min : min + (max - min) / 2);

    const { value: rawValue, setValue: setRawValue } =
      useControlledValue<number>({
        defaultValue: computedDefaultValue,
        onChange: onValueChange,
        transform: (val: number) => {
          const numValue = Number(val);
          if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
            return min;
          }
          return clamp(numValue, min, max);
        },
        value: controlledValue,
      });

    const value = rawValue ?? min;
    const valueRef = useValueAsRef(value);

    const updateValue = React.useCallback(
      (newValue: number) => {
        const clampedValue = clamp(newValue, min, max);
        const steppedValue = quantizeRound(clampedValue, step);
        setRawValue(steppedValue);
      },
      [min, max, step, setRawValue]
    );

    const commitValue = React.useCallback(
      (newValue: number) => {
        const clampedValue = clamp(newValue, min, max);
        const steppedValue = quantizeRound(clampedValue, step);
        setRawValue(steppedValue);
        onValueCommit?.(steppedValue);
      },
      [min, max, step, setRawValue, onValueCommit]
    );

    const dragStartValueRef = React.useRef(value);
    const isDragActiveRef = React.useRef(false);
    const pendingValueRef = React.useRef(value);
    const shouldPreventFocusRef = React.useRef(false);
    const prevAngleRef = React.useRef(0);
    const accumulatedAngleDeltaRef = React.useRef(0);
    const dragModeRef = React.useRef<"undecided" | "pan" | "rotate">(
      "undecided"
    );
    const dragStartPosRef = React.useRef<Point>({ x: 0, y: 0 });
    const lastTapAtRef = React.useRef(0);
    /** Snapshot at pointerdown — stable center, fewer layout reads during drag. */
    const dragKnobRectRef = React.useRef<DOMRect | null>(null);
    const dragSensitivityRef = React.useRef<DragSensitivity>(dragSensitivity);
    dragSensitivityRef.current = dragSensitivity;
    const resolvedDragConfigState = resolvedDragConfig(dragOptions);
    const resolvedDragRef = React.useRef(resolvedDragConfigState);
    resolvedDragRef.current = resolvedDragConfigState;

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        shouldPreventFocusRef.current = true;
        e.preventDefault();
        if (knobRef.current && !disabled) {
          knobRef.current.focus();
        }
      },
      [disabled]
    );

    const calculateValueFromDelta = React.useCallback(
      (delta: Point, initialValue: number) => {
        const div = resolvedDragRef.current.panSensitivityDivisor;
        const sensitivity = (max - min) / div;
        return initialValue + delta.y * sensitivity;
      },
      [min, max]
    );

    const updateAngleTracking = React.useCallback(
      (clientX: number, clientY: number, rect: DOMRect) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        const minDim = Math.min(rect.width, rect.height);
        const d = resolvedDragRef.current;
        const dead = Math.max(
          d.centerDeadZoneMinPx,
          minDim * d.centerDeadZoneRel
        );
        const currentAngle = Math.atan2(dy, dx);
        if (dist <= dead) {
          prevAngleRef.current = currentAngle;
          return;
        }
        let angleDelta = currentAngle - prevAngleRef.current;
        if (angleDelta > Math.PI) {
          angleDelta -= TAU;
        }
        if (angleDelta < -Math.PI) {
          angleDelta += TAU;
        }
        accumulatedAngleDeltaRef.current += angleDelta;
        prevAngleRef.current = currentAngle;
      },
      []
    );

    const resolveDragMode = React.useCallback(
      (clientX: number, clientY: number, rect: DOMRect) => {
        if (dragModeRef.current !== "undecided") {
          return;
        }
        const movedX = Math.abs(clientX - dragStartPosRef.current.x);
        const movedY = Math.abs(clientY - dragStartPosRef.current.y);
        const minDim = Math.min(rect.width, rect.height);
        const d = resolvedDragRef.current;
        const threshold = Math.max(d.modeLockMinPx, minDim * d.modeLockRel);
        if (movedX + movedY <= threshold) {
          return;
        }
        if (!d.verticalPanEnabled) {
          dragModeRef.current = "rotate";
          return;
        }
        const panCandidate =
          movedY >= d.panMinVerticalPx && movedY > movedX * d.panDominanceRatio;
        dragModeRef.current = panCandidate ? "pan" : "rotate";
      },
      []
    );

    const onDrag = React.useCallback(
      (e: React.PointerEvent, delta: Point) => {
        const rect = dragKnobRectRef.current;

        if (rect) {
          resolveDragMode(e.clientX, e.clientY, rect);
          if (dragModeRef.current !== "pan") {
            updateAngleTracking(e.clientX, e.clientY, rect);
          }
        }

        let newValue: number;
        if (dragModeRef.current === "pan" || !rect) {
          newValue = calculateValueFromDelta(delta, dragStartValueRef.current);
        } else {
          const referenceRad =
            dragSensitivityRef.current === "revolution"
              ? TAU
              : degToRad(angleRange);
          const valueDelta =
            (accumulatedAngleDeltaRef.current / referenceRad) * (max - min);
          newValue = dragStartValueRef.current + valueDelta;
        }

        pendingValueRef.current = newValue;
        updateValue(newValue);
      },
      [
        calculateValueFromDelta,
        updateValue,
        angleRange,
        max,
        min,
        resolveDragMode,
        updateAngleTracking,
      ]
    );

    const onDragStart = React.useCallback(
      (e: React.PointerEvent) => {
        isDragActiveRef.current = true;
        dragStartValueRef.current = value;
        pendingValueRef.current = value;
        accumulatedAngleDeltaRef.current = 0;
        dragModeRef.current = "undecided";
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };

        const el = knobRef.current;
        const rect = el?.getBoundingClientRect() ?? null;
        dragKnobRectRef.current = rect;
        if (rect) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          prevAngleRef.current = Math.atan2(
            e.clientY - centerY,
            e.clientX - centerX
          );
        }
      },
      [value]
    );

    const onDragEnd = React.useCallback(
      (e: React.PointerEvent) => {
        isDragActiveRef.current = false;
        dragModeRef.current = "undecided";
        dragKnobRectRef.current = null;

        const moved = Math.hypot(
          e.clientX - dragStartPosRef.current.x,
          e.clientY - dragStartPosRef.current.y
        );

        if (
          !disabled &&
          moved <= KNOB_DOUBLE_TAP_MAX_MOVE_PX &&
          lastTapAtRef.current > 0 &&
          performance.now() - lastTapAtRef.current <= KNOB_DOUBLE_TAP_MAX_MS
        ) {
          lastTapAtRef.current = 0;
          const resetTo = quantizeRound(
            clamp(computedDefaultValue, min, max),
            step
          );
          commitValue(resetTo);
          return;
        }

        if (!disabled && moved <= KNOB_DOUBLE_TAP_MAX_MOVE_PX) {
          lastTapAtRef.current = performance.now();
        } else {
          lastTapAtRef.current = 0;
        }

        commitValue(pendingValueRef.current);
      },
      [commitValue, computedDefaultValue, disabled, max, min, step]
    );

    const { wheelRef } = useWheel({
      disabled,
      elementRef: knobRef,
      onWheel: (delta: Point) => {
        if (Math.abs(delta.y) < 0.1) {
          return;
        }
        const direction = delta.y < 0 ? 1 : -1;
        const deltaValue = direction * step;
        const newValue = clamp(valueRef.current + deltaValue, min, max);
        commitValue(quantizeRound(newValue, step));
      },
    });

    React.useEffect(() => {
      if (!isDragActiveRef.current) {
        dragStartValueRef.current = value;
        pendingValueRef.current = value;
      }
    }, [value]);

    const percentage = (value - min) / (max - min);
    const anchorPercentage =
      anchor === undefined ? 0 : clamp((anchor - min) / (max - min), 0, 1);
    const rotation = angleOffset + percentage * angleRange;
    const elementId = id || knobId;

    const contextValue = React.useMemo<KnobContextValue>(
      () => ({
        anchorPercentage,
        angleOffset,
        angleRange,
        arcStrokeWidth,
        arcTrackRadius,
        ariaLabel,
        ariaLabelledBy,
        commitValue,
        disabled,
        elementId,
        indicatorSpan,
        indicatorWidth,
        knobRef,
        max,
        min,
        onDrag,
        onDragEnd,
        onDragStart,
        onPointerDown,
        onValueCommit,
        percentage,
        rotation,
        setRawValue,
        shouldPreventFocusRef,
        step,
        updateValue,
        value,
        valueRef,
        wheelRef,
      }),
      [
        value,
        min,
        max,
        step,
        disabled,
        angleRange,
        angleOffset,
        percentage,
        anchorPercentage,
        rotation,
        elementId,
        arcTrackRadius,
        arcStrokeWidth,
        indicatorSpan,
        indicatorWidth,
        updateValue,
        commitValue,
        valueRef,
        setRawValue,
        onValueCommit,
        ariaLabel,
        ariaLabelledBy,
        wheelRef,
        onPointerDown,
        onDragStart,
        onDrag,
        onDragEnd,
      ]
    );

    return (
      <KnobContext.Provider value={contextValue}>
        <div
          className={className}
          {...getDataAttributes("knob", { part: "knob-wrapper" })}
          {...props}
        >
          {ariaLabel || ariaLabelledBy ? null : (
            <span className="sr-only" id={`${elementId}-label`}>
              Knob
            </span>
          )}
          {children}
        </div>
      </KnobContext.Provider>
    );
  }

  export interface SliderProps extends React.ComponentProps<"div"> {}

  export function Slider({ className, ref, ...props }: SliderProps) {
    const {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      min,
      max,
      value,
      knobRef,
      wheelRef,
      focusProps,
      keyboardProps,
      pointerProps,
      shouldPreventFocusRef,
    } = useKnobSlider();

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        knobRef.current = node;
        wheelRef(node);
        if (typeof ref === "function") {
          ref(node);
        } else if (ref !== null) {
          ref.current = node;
        }
      },
      [knobRef, ref, wheelRef]
    );

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
        {...getDataAttributes("knob", { disabled })}
        role="slider"
        {...focusProps}
        {...keyboardProps}
        {...pointerProps}
        onFocus={(e) => {
          if (shouldPreventFocusRef.current) {
            shouldPreventFocusRef.current = false;
          }
          focusProps.onFocus(e);
        }}
        ref={setRefs}
        tabIndex={disabled ? -1 : focusProps.tabIndex}
        {...props}
      />
    );
  }

  export interface ArcProps extends React.ComponentProps<"svg"> {
    /**
     * Stroke width in SVG user units (viewBox is 48×48).
     * Scale this up for smaller rendered knobs so the arc stays ~constant thickness in CSS pixels
     * (non-scaling-vector stroke is unreliable when the SVG is sized via Tailwind).
     */
    strokeWidth?: number;
  }

  export function Arc({
    className,
    style,
    strokeWidth: pathStrokeWidth,
    ...props
  }: ArcProps) {
    const {
      angleOffset,
      percentage,
      anchorPercentage,
      angleRange,
      arcStrokeWidth,
      arcTrackRadius,
    } = useKnobContext();

    const tLo = Math.min(anchorPercentage, percentage);
    const tHi = Math.max(anchorPercentage, percentage);
    const hasArc = Math.abs(percentage - anchorPercentage) > 0.001;
    const strokeW = pathStrokeWidth ?? arcStrokeWidth;
    const railD = knobArcAlongTrack(
      arcTrackRadius,
      angleOffset,
      angleRange,
      0,
      1
    );

    return (
      <svg
        className={className}
        {...getDataAttributes("knob", { part: "arc" })}
        style={{ display: "block", ...style }}
        viewBox="0 0 48 48"
        {...props}
      >
        <title>Knob arc</title>
        <path
          d={railD}
          fill="none"
          opacity={0.22}
          strokeLinecap="round"
          strokeWidth={strokeW}
        />
        {hasArc && (
          <path
            d={knobArcAlongTrack(
              arcTrackRadius,
              angleOffset,
              angleRange,
              tLo,
              tHi
            )}
            fill="none"
            strokeLinecap="round"
            strokeWidth={strokeW}
          />
        )}
      </svg>
    );
  }

  export interface IndicatorProps extends React.ComponentProps<"svg"> {
    strokeWidth?: number;
  }

  /** Radial needle (SVG line); render above {@link Arc} and {@link Body}. */
  export function Indicator({
    className,
    style,
    strokeWidth: strokeWidthProp,
    ...props
  }: IndicatorProps) {
    const {
      angleOffset,
      percentage,
      angleRange,
      arcTrackRadius,
      indicatorSpan,
      indicatorWidth,
    } = useKnobContext();

    const angle = knobPolarRad(angleOffset, angleRange, percentage);
    const [r0, r1] = indicatorSpan;
    const innerR = arcTrackRadius * r0;
    const outerR = arcTrackRadius * r1;
    const x1 = KNOB_VIEWBOX_CX + innerR * Math.cos(angle);
    const y1 = KNOB_VIEWBOX_CY + innerR * Math.sin(angle);
    const x2 = KNOB_VIEWBOX_CX + outerR * Math.cos(angle);
    const y2 = KNOB_VIEWBOX_CY + outerR * Math.sin(angle);

    return (
      <svg
        aria-hidden
        className={className}
        {...getDataAttributes("knob", { part: "indicator" })}
        style={{ display: "block", ...style }}
        viewBox="0 0 48 48"
        {...props}
      >
        <title>Knob indicator</title>
        <line
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={strokeWidthProp ?? indicatorWidth}
          x1={x1}
          x2={x2}
          y1={y1}
          y2={y2}
        />
      </svg>
    );
  }

  export interface BodyProps extends React.ComponentProps<"div"> {}

  export function Body({ className, ...props }: BodyProps) {
    const { rotation } = useKnobContext();
    return (
      <div
        className={className}
        {...getDataAttributes("knob", { part: "body" })}
        style={{ transform: `rotate(${rotation}deg)` }}
        {...props}
      />
    );
  }

  function useKnobSlider() {
    const {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      min,
      max,
      value,
      knobRef,
      wheelRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
      shouldPreventFocusRef,
      valueRef,
      step,
      commitValue,
    } = useKnobContext();

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: knobRef,
      onDrag,
      onDragCancel: onDragEnd,
      onDragEnd,
      onDragStart,
      onPointerDown,
      releaseOnOutsideClick: true,
    });

    const { focusProps } = useFocus({
      disabled,
      onFocus: () => {
        if (shouldPreventFocusRef.current) {
          shouldPreventFocusRef.current = false;
        }
      },
    });

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowDown: () => {
          commitValue(valueRef.current - step);
          return true;
        },
        onArrowLeft: () => {
          commitValue(valueRef.current - step);
          return true;
        },
        onArrowRight: () => {
          commitValue(valueRef.current + step);
          return true;
        },
        onArrowUp: () => {
          commitValue(valueRef.current + step);
          return true;
        },
        onEnd: () => {
          commitValue(max);
          return true;
        },
        onHome: () => {
          commitValue(min);
          return true;
        },
        onPageDown: () => {
          commitValue(valueRef.current - step * 10);
          return true;
        },
        onPageUp: () => {
          commitValue(valueRef.current + step * 10);
          return true;
        },
      },
    });

    return {
      ariaLabel,
      ariaLabelledBy,
      disabled,
      elementId,
      focusProps,
      keyboardProps,
      knobRef,
      max,
      min,
      pointerProps,
      shouldPreventFocusRef,
      value,
      wheelRef,
    };
  }
}
