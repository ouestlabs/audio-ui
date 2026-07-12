import type { Point as GeomPoint, Nullable, Procedure } from "@audio-ui/utils";
import { clamp, clampUnit, panic } from "@audio-ui/utils";
import * as React from "react";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import { getDataAttributes } from "./internal/data-attributes";
import { useParameterCore } from "./internal/use-parameter-core";

const MIN_POINTS = 2;
const KEYBOARD_STEP = 0.01;
/** How long a blocked-action signal (data-blocked) stays on before it clears — matched to the shake animation's total duration. */
const BLOCKED_DURATION_MS = 320;
/** ADSR-shaped: attack to peak, decay to a sustain plateau, release — reads as an envelope rather than a bare triangle. */
const DEFAULT_VALUE: GeomPoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

function sortPoints(points: GeomPoint[]): GeomPoint[] {
  return [...points].sort((a, b) => a.x - b.x);
}

/** One decimal place is plenty of precision for a 0-100 SVG coordinate, and keeps the `points` string short during drag. */
function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

function sanitizePoints(points: GeomPoint[]): GeomPoint[] {
  return sortPoints(
    points.map((p) => ({ x: clampUnit(p.x), y: clampUnit(p.y) }))
  );
}

/** Clamp a candidate point's x between its neighbors in `base` (so points can never cross or reorder) and y to [0,1]. */
function clampToNeighbors(
  base: GeomPoint[],
  index: number,
  next: GeomPoint
): Nullable<GeomPoint> {
  const current = base[index];
  if (!current) {
    return null;
  }
  const prev = base[index - 1];
  const nextNeighbor = base[index + 1];
  const lowX = prev ? prev.x : 0;
  const highX = nextNeighbor ? nextNeighbor.x : 1;
  return {
    x: clamp(next.x, lowX, highX),
    y: clampUnit(next.y),
  };
}

export namespace Envelope {
  interface ConfigContextValue {
    adjustPoint: (index: number, next: GeomPoint) => void;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    beginPointDrag: () => void;
    blockedIndex: Nullable<number>;
    commitDrag: () => void;
    dragPoint: (index: number, next: GeomPoint) => void;
    handleSvgDoubleClick: (point: GeomPoint) => void;
    isAddBlocked: boolean;
    minPoints: number;
    pointsConfig: {
      disabled: boolean;
    };
    registerPoint: (index: number, node: Nullable<HTMLElement>) => void;
    removePoint: (index: number) => void;
    setFocusedIndex: Procedure<number>;
    shouldPreventFocusRef: React.RefObject<boolean>;
    svgRef: React.RefObject<Nullable<SVGSVGElement>>;
  }

  /** Split from config: changes every drag frame, so only components that render live positions subscribe to it. */
  interface ValueContextValue {
    focusedIndex: number;
    value: GeomPoint[];
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("Envelope components must be used within Envelope.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("Envelope components must be used within Envelope.Root");
    }
    return context;
  }

  export interface RootProps
    extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
    /** Whether double-clicking empty space adds a point. */
    allowAddPoints?: boolean;
    /** Whether double-clicking (or Delete/Backspace on) a point removes it. */
    allowRemovePoints?: boolean;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: GeomPoint[];
    disabled?: boolean;
    /** Floor on the number of points; removal is blocked at this count. */
    minPoints?: number;
    onValueChange?: Procedure<GeomPoint[]>;
    onValueCommit?: Procedure<GeomPoint[]>;
    value?: GeomPoint[];
  }

  export function Root({
    value: controlledValue,
    defaultValue = DEFAULT_VALUE,
    allowAddPoints = true,
    allowRemovePoints = true,
    minPoints = MIN_POINTS,
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
    const envelopeId = React.useId();
    const svgRef = React.useRef<SVGSVGElement>(null);
    const pointElementsRef = React.useRef(new Map<number, HTMLElement>());
    const [focusedIndex, setFocusedIndex] = React.useState(0);
    const [blockedIndex, setBlockedIndex] =
      React.useState<Nullable<number>>(null);
    const [isAddBlocked, setIsAddBlocked] = React.useState(false);
    const blockedIndexTimeoutRef =
      React.useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
    const addBlockedTimeoutRef =
      React.useRef<Nullable<ReturnType<typeof setTimeout>>>(null);

    React.useEffect(
      () => () => {
        if (blockedIndexTimeoutRef.current) {
          clearTimeout(blockedIndexTimeoutRef.current);
        }
        if (addBlockedTimeoutRef.current) {
          clearTimeout(addBlockedTimeoutRef.current);
        }
      },
      []
    );

    const {
      beginDrag,
      commitValue,
      dragTo,
      endDrag,
      pendingValueRef,
      shouldPreventFocusRef,
      value: points,
      valueRef,
    } = useParameterCore<GeomPoint[]>({
      clampStep: sanitizePoints,
      defaultValue: sanitizePoints(defaultValue),
      disabled,
      fallbackValue: sanitizePoints(defaultValue),
      onValueChange,
      onValueCommit,
      transform: sanitizePoints,
      value: controlledValue,
    });

    const focusPoint = React.useCallback(
      (index: number) => {
        const clamped = clamp(index, 0, valueRef.current.length - 1);
        setFocusedIndex(clamped);
        pointElementsRef.current.get(clamped)?.focus();
      },
      [valueRef]
    );

    const registerPoint = React.useCallback(
      (index: number, node: Nullable<HTMLElement>) => {
        if (node) {
          pointElementsRef.current.set(index, node);
        } else {
          pointElementsRef.current.delete(index);
        }
      },
      []
    );

    const triggerBlockedPoint = React.useCallback((index: number) => {
      if (blockedIndexTimeoutRef.current) {
        clearTimeout(blockedIndexTimeoutRef.current);
      }
      // Clear then re-set on the next frame so the data-blocked attribute
      // is observably removed and re-added, guaranteeing the CSS shake
      // replays even when the same point is blocked again in quick succession.
      setBlockedIndex(null);
      requestAnimationFrame(() => {
        setBlockedIndex(index);
        blockedIndexTimeoutRef.current = setTimeout(() => {
          setBlockedIndex(null);
        }, BLOCKED_DURATION_MS);
      });
    }, []);

    const triggerAddBlocked = React.useCallback(() => {
      if (addBlockedTimeoutRef.current) {
        clearTimeout(addBlockedTimeoutRef.current);
      }
      setIsAddBlocked(false);
      requestAnimationFrame(() => {
        setIsAddBlocked(true);
        addBlockedTimeoutRef.current = setTimeout(() => {
          setIsAddBlocked(false);
        }, BLOCKED_DURATION_MS);
      });
    }, []);

    const beginPointDrag = React.useCallback(() => {
      beginDrag(valueRef.current);
    }, [beginDrag, valueRef]);

    const dragPoint = React.useCallback(
      (index: number, next: GeomPoint) => {
        const base = pendingValueRef.current;
        const clamped = clampToNeighbors(base, index, next);
        if (!clamped) {
          return;
        }
        const nextPoints = [...base];
        nextPoints[index] = clamped;
        dragTo(nextPoints);
      },
      [dragTo, pendingValueRef]
    );

    const commitDrag = React.useCallback(() => {
      endDrag();
    }, [endDrag]);

    const adjustPoint = React.useCallback(
      (index: number, next: GeomPoint) => {
        const base = valueRef.current;
        const clamped = clampToNeighbors(base, index, next);
        if (!clamped) {
          return;
        }
        const nextPoints = [...base];
        nextPoints[index] = clamped;
        commitValue(nextPoints);
      },
      [commitValue, valueRef]
    );

    const handleSvgDoubleClick = React.useCallback(
      (point: GeomPoint) => {
        if (disabled) {
          return;
        }
        if (!allowAddPoints) {
          triggerAddBlocked();
          return;
        }
        const clamped: GeomPoint = {
          x: clampUnit(point.x),
          y: clampUnit(point.y),
        };
        const nextPoints = sortPoints([...valueRef.current, clamped]);
        const index = nextPoints.indexOf(clamped);
        commitValue(nextPoints);
        shouldPreventFocusRef.current = true;
        setFocusedIndex(index);
      },
      [
        disabled,
        allowAddPoints,
        triggerAddBlocked,
        valueRef,
        commitValue,
        shouldPreventFocusRef,
      ]
    );

    const removePoint = React.useCallback(
      (index: number) => {
        const base = valueRef.current;
        if (disabled || !allowRemovePoints || base.length <= minPoints) {
          if (!disabled) {
            triggerBlockedPoint(index);
          }
          return;
        }
        const nextPoints = base.filter((_, i) => i !== index);
        commitValue(nextPoints);
        focusPoint(Math.min(index, nextPoints.length - 1));
      },
      [
        disabled,
        allowRemovePoints,
        minPoints,
        valueRef,
        commitValue,
        focusPoint,
        triggerBlockedPoint,
      ]
    );

    const elementId = id || envelopeId;

    const pointsConfig = React.useMemo(() => ({ disabled }), [disabled]);

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        adjustPoint,
        ariaLabel,
        ariaLabelledBy,
        beginPointDrag,
        blockedIndex,
        commitDrag,
        dragPoint,
        handleSvgDoubleClick,
        isAddBlocked,
        minPoints,
        pointsConfig,
        registerPoint,
        removePoint,
        setFocusedIndex,
        shouldPreventFocusRef,
        svgRef,
      }),
      [
        adjustPoint,
        ariaLabel,
        ariaLabelledBy,
        beginPointDrag,
        blockedIndex,
        commitDrag,
        dragPoint,
        handleSvgDoubleClick,
        isAddBlocked,
        minPoints,
        pointsConfig,
        registerPoint,
        removePoint,
        shouldPreventFocusRef,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ focusedIndex, value: points }),
      [focusedIndex, points]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("envelope", {
              disabled,
              part: "envelope-wrapper",
            })}
            style={{ position: "relative", ...style }}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Envelope
              </span>
            )}
            <span className="sr-only" id={`${elementId}-instructions`}>
              Use arrow keys to adjust the focused point, delete or backspace to
              remove it. Double-click empty space to add a point, or a point to
              remove it.
            </span>
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface SvgProps
    extends Omit<React.ComponentProps<"svg">, "viewBox"> {}

  export function Svg({ className, children, ...props }: SvgProps) {
    const {
      ariaLabel,
      ariaLabelledBy,
      handleSvgDoubleClick,
      isAddBlocked,
      pointsConfig,
      svgRef,
    } = useConfigContext();
    const { disabled } = pointsConfig;

    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (disabled) {
          return;
        }
        const svg = svgRef.current;
        if (!svg) {
          return;
        }
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }
        handleSvgDoubleClick({
          x: (e.clientX - rect.left) / rect.width,
          y: 1 - (e.clientY - rect.top) / rect.height,
        });
      },
      [disabled, handleSvgDoubleClick, svgRef]
    );

    return (
      <svg
        aria-label={ariaLabel || "Envelope"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : "envelope-label")
        }
        className={className}
        onDoubleClick={handleDoubleClick}
        preserveAspectRatio="none"
        ref={svgRef}
        role="group"
        viewBox="0 0 100 100"
        {...getDataAttributes("envelope", {
          blocked: isAddBlocked,
          disabled,
          part: "svg",
        })}
        {...props}
      >
        {children}
      </svg>
    );
  }

  /** Polyline coordinates: flat lead-in from x=0 to the first point, the points themselves, flat lead-out from the last point to x=1. */
  function useEnvelopePath() {
    const { value } = useValueContext();
    return React.useMemo(() => {
      const [first] = value;
      const last = value.at(-1);
      if (!(first && last)) {
        return "";
      }
      const segments = [
        `0,${roundCoord((1 - first.y) * 100)}`,
        ...value.map(
          (point) =>
            `${roundCoord(point.x * 100)},${roundCoord((1 - point.y) * 100)}`
        ),
        `100,${roundCoord((1 - last.y) * 100)}`,
      ];
      return segments.join(" ");
    }, [value]);
  }

  export interface PathProps extends React.ComponentProps<"polyline"> {}

  export function Path({ className, style, ...props }: PathProps) {
    const path = useEnvelopePath();
    return (
      <polyline
        className={className}
        fill="none"
        {...getDataAttributes("envelope", { part: "path" })}
        points={path}
        style={{ vectorEffect: "non-scaling-stroke", ...style }}
        {...props}
      />
    );
  }

  export interface FillProps extends React.ComponentProps<"polyline"> {}

  export function Fill({ className, ...props }: FillProps) {
    const path = useEnvelopePath();
    const closedPath = path ? `${path} 100,100 0,100` : "";
    return (
      <polyline
        className={className}
        {...getDataAttributes("envelope", { part: "fill" })}
        points={closedPath}
        {...props}
      />
    );
  }

  export interface PointsProps {
    children: (point: GeomPoint, index: number) => React.ReactNode;
  }

  export function Points({ children }: PointsProps) {
    const { value } = useValueContext();
    return <>{value.map((point, index) => children(point, index))}</>;
  }

  export interface PointProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    index: number;
  }

  /** A draggable handle positioned via left/bottom percentage, same technique as Fader.Thumb — decoupled from the Svg's own (non-uniformly scaled) coordinate system so it always renders as a true circle/radius, never a stretched ellipse. */
  export function Point({ index, className, style, ...props }: PointProps) {
    const {
      adjustPoint,
      beginPointDrag,
      blockedIndex,
      commitDrag,
      dragPoint,
      minPoints,
      pointsConfig,
      registerPoint,
      removePoint,
      setFocusedIndex,
      shouldPreventFocusRef,
      svgRef,
    } = useConfigContext();
    const { disabled } = pointsConfig;
    const { focusedIndex, value } = useValueContext();
    const point = value[index];

    const isDraggingRef = React.useRef(false);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        shouldPreventFocusRef.current = true;
        setFocusedIndex(index);
        e.currentTarget.focus();
        beginPointDrag();
      },
      [disabled, index, setFocusedIndex, shouldPreventFocusRef, beginPointDrag]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) {
          return;
        }
        const svg = svgRef.current;
        if (!svg) {
          return;
        }
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }
        dragPoint(index, {
          x: (e.clientX - rect.left) / rect.width,
          y: 1 - (e.clientY - rect.top) / rect.height,
        });
      },
      [index, dragPoint, svgRef]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) {
          return;
        }
        isDraggingRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
        commitDrag();
      },
      [commitDrag]
    );

    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent) => {
        if (disabled) {
          return;
        }
        e.stopPropagation();
        removePoint(index);
      },
      [disabled, index, removePoint]
    );

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowDown: () => {
          if (point) {
            adjustPoint(index, { x: point.x, y: point.y - KEYBOARD_STEP });
          }
          return true;
        },
        onArrowLeft: () => {
          if (point) {
            adjustPoint(index, { x: point.x - KEYBOARD_STEP, y: point.y });
          }
          return true;
        },
        onArrowRight: () => {
          if (point) {
            adjustPoint(index, { x: point.x + KEYBOARD_STEP, y: point.y });
          }
          return true;
        },
        onArrowUp: () => {
          if (point) {
            adjustPoint(index, { x: point.x, y: point.y + KEYBOARD_STEP });
          }
          return true;
        },
      },
      onKeyDown: (e) => {
        if (disabled) {
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removePoint(index);
        }
      },
    });

    const handleFocus = React.useCallback(() => {
      if (shouldPreventFocusRef.current) {
        shouldPreventFocusRef.current = false;
      }
      setFocusedIndex(index);
    }, [index, setFocusedIndex, shouldPreventFocusRef]);

    const pointRef = React.useCallback(
      (node: Nullable<HTMLDivElement>) => registerPoint(index, node),
      [index, registerPoint]
    );

    if (!point) {
      return null;
    }

    const isFocusTarget = index === focusedIndex;
    const isBlocked = index === blockedIndex;
    const baseTransform = "translate(-50%, 50%)";
    const transform = style?.transform
      ? `${baseTransform} ${style.transform}`
      : baseTransform;

    return (
      <div
        aria-disabled={disabled}
        aria-label={`Point ${index + 1} of ${value.length}`}
        aria-valuemax={1}
        aria-valuemin={0}
        aria-valuenow={point.y}
        aria-valuetext={`x: ${point.x.toFixed(2)}, y: ${point.y.toFixed(2)}`}
        className={className}
        {...getDataAttributes("envelope", {
          blocked: isBlocked,
          disabled,
          part: "point",
          removable: value.length > minPoints,
        })}
        onDoubleClick={handleDoubleClick}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={pointRef}
        role="slider"
        style={{
          bottom: `${point.y * 100}%`,
          left: `${point.x * 100}%`,
          position: "absolute",
          ...style,
          transform,
        }}
        tabIndex={disabled || !isFocusTarget ? -1 : 0}
        {...keyboardProps}
        {...props}
      />
    );
  }
}
