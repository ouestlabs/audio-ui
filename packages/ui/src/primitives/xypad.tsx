import type { Nullable, Procedure } from "@audio-ui/utils";
import {
  clamp,
  clampUnit,
  type Point,
  panic,
  quantizeRound,
} from "@audio-ui/utils";
import * as React from "react";
import { useFocus } from "../hooks/interactions/use-focus";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import { usePointerDrag } from "../hooks/interactions/use-pointer-drag";
import { useWheel } from "../hooks/interactions/use-wheel";
import { getDataAttributes } from "./internal/data-attributes";
import {
  type UseParameterCoreDragCallbacks,
  useParameterCore,
} from "./internal/use-parameter-core";

const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  border: 0,
  clip: "rect(0, 0, 0, 0)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

export namespace XYPad {
  interface ConfigContextValue {
    ariaLabel?: string;
    ariaLabelledBy?: string;
    containerRef: React.RefObject<Nullable<HTMLDivElement>>;
    disabled: boolean;
    dragCallbacks: UseParameterCoreDragCallbacks;
    elementId: string;
    keyboardProps: { onKeyDown: Procedure<React.KeyboardEvent> };
    shouldPreventFocusRef: React.RefObject<boolean>;
    wheelRef: Procedure<Nullable<HTMLDivElement>>;
  }

  /** Split from config: changes every drag frame, so only components that render live position subscribe to it. */
  interface ValueContextValue {
    percentageX: number;
    percentageY: number;
    thumbX: number;
    thumbY: number;
    value: Point;
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("XYPad components must be used within XYPad.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("XYPad components must be used within XYPad.Root");
    }
    return context;
  }

  function useContext() {
    return { ...useConfigContext(), ...useValueContext() };
  }
  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      "onChange" | "onInput" | "type" | "value" | "defaultValue"
    > {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: Point;
    disabled?: boolean;
    maxX?: number;
    maxY?: number;
    minX?: number;
    minY?: number;
    onValueChange?: Procedure<Point>;
    onValueCommit?: Procedure<Point>;
    stepX?: number;
    stepY?: number;
    value?: Point;
  }

  export function Root({
    value: controlledValue,
    defaultValue = { x: 0, y: 0 },
    minX = 0,
    maxX = 100,
    minY = 0,
    maxY = 100,
    stepX = 1,
    stepY = 1,
    disabled = false,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    children,
    ...props
  }: RootProps) {
    const xypadId = React.useId();
    const containerRef = React.useRef<HTMLDivElement>(null);

    const transformValue = React.useCallback(
      (val: Point) => {
        const numX = Number(val.x);
        const numY = Number(val.y);
        const clampedX =
          Number.isNaN(numX) || !Number.isFinite(numX)
            ? minX
            : clamp(numX, minX, maxX);
        const clampedY =
          Number.isNaN(numY) || !Number.isFinite(numY)
            ? minY
            : clamp(numY, minY, maxY);
        return { x: clampedX, y: clampedY };
      },
      [minX, maxX, minY, maxY]
    );

    const clampStep = React.useCallback(
      (next: Point) => ({
        x: quantizeRound(clamp(next.x, minX, maxX), stepX),
        y: quantizeRound(clamp(next.y, minY, maxY), stepY),
      }),
      [minX, maxX, stepX, minY, maxY, stepY]
    );

    const calculateValueFromPoint = React.useCallback(
      (point: Point): Nullable<Point> => {
        const container = containerRef.current;
        if (!container) {
          return null;
        }

        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return null;
        }
        const normalizedX = clampUnit((point.x - rect.left) / rect.width);
        const normalizedY = clampUnit((point.y - rect.top) / rect.height);

        return {
          x: minX + normalizedX * (maxX - minX),
          y: maxY - normalizedY * (maxY - minY),
        };
      },
      [minX, maxX, minY, maxY]
    );

    const calculateValueFromDelta = React.useCallback(
      (delta: Point, initialValue: Point) => {
        const container = containerRef.current;
        if (!container) {
          return initialValue;
        }

        const rect = container.getBoundingClientRect();
        const sensitivityX = (maxX - minX) / Math.max(rect.width, 1);
        const sensitivityY = (maxY - minY) / Math.max(rect.height, 1);

        return {
          x: initialValue.x + delta.x * sensitivityX,
          y: initialValue.y + delta.y * sensitivityY,
        };
      },
      [minX, maxX, minY, maxY]
    );

    const {
      commitValue,
      dragCallbacks,
      shouldPreventFocusRef,
      value,
      valueRef,
    } = useParameterCore<Point>({
      clampStep,
      defaultValue,
      deltaToValue: calculateValueFromDelta,
      disabled,
      fallbackValue: { x: minX, y: minY },
      focusRef: containerRef,
      onValueChange,
      onValueCommit,
      pointToValue: calculateValueFromPoint,
      transform: transformValue,
      value: controlledValue,
    });

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowDown: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y - stepY,
          });
          return true;
        },
        onArrowLeft: () => {
          commitValue({
            x: valueRef.current.x - stepX,
            y: valueRef.current.y,
          });
          return true;
        },
        onArrowRight: () => {
          commitValue({
            x: valueRef.current.x + stepX,
            y: valueRef.current.y,
          });
          return true;
        },
        onArrowUp: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y + stepY,
          });
          return true;
        },
        onEnd: () => {
          commitValue({ x: maxX, y: minY });
          return true;
        },
        onHome: () => {
          commitValue({ x: minX, y: maxY });
          return true;
        },
        onPageDown: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y - stepY * 10,
          });
          return true;
        },
        onPageUp: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y + stepY * 10,
          });
          return true;
        },
      },
    });

    const { wheelRef } = useWheel({
      disabled,
      onWheel: (delta: Point) => {
        const container = containerRef.current;
        if (!container) {
          return;
        }

        const rect = container.getBoundingClientRect();
        const sensitivityX = (maxX - minX) / Math.max(rect.width, 1);
        const sensitivityY = (maxY - minY) / Math.max(rect.height, 1);

        commitValue({
          x: valueRef.current.x - delta.x * sensitivityX,
          y: valueRef.current.y + delta.y * sensitivityY,
        });
      },
    });

    const percentageX = clampUnit((value.x - minX) / (maxX - minX || 1));
    const percentageY = clampUnit((value.y - minY) / (maxY - minY || 1));
    const thumbX = percentageX * 100;
    const thumbY = (1 - percentageY) * 100;
    const elementId = id || xypadId;

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        ariaLabel,
        ariaLabelledBy,
        containerRef,
        disabled,
        dragCallbacks,
        elementId,
        keyboardProps,
        shouldPreventFocusRef,
        wheelRef,
      }),
      [
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragCallbacks,
        elementId,
        keyboardProps,
        shouldPreventFocusRef,
        wheelRef,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ percentageX, percentageY, thumbX, thumbY, value }),
      [percentageX, percentageY, thumbX, thumbY, value]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div className={className} {...props}>
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                XY Pad
              </span>
            )}
            <span className="sr-only" id={`${elementId}-instructions`}>
              Use arrow keys to adjust X and Y values.
            </span>
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export function Slider({
    className,
    "aria-describedby": ariaDescribedBy,
    ...props
  }: React.ComponentProps<"div">) {
    const context = useConfigContext();
    const {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      containerRef,
      wheelRef,
      dragCallbacks,
      shouldPreventFocusRef,
      keyboardProps,
    } = context;

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: containerRef,
      releaseOnOutsideClick: true,
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
        aria-describedby={ariaDescribedBy || `${elementId}-instructions`}
        aria-disabled={disabled}
        aria-label={ariaLabel || "XY Pad"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        className={className}
        {...getDataAttributes("xypad", { disabled })}
        ref={(node) => {
          containerRef.current = node;
          wheelRef(node);
        }}
        role="group"
        {...focusProps}
        {...keyboardProps}
        {...pointerProps}
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

  export interface GridProps extends React.ComponentProps<"div"> {}

  export function Grid({ className, ...props }: GridProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "grid" })}
        {...props}
      />
    );
  }

  export interface GridLineProps extends React.ComponentProps<"div"> {
    orientation: "vertical" | "horizontal";
    position: number;
  }

  export function GridLine({
    className,
    orientation,
    position,
    ...props
  }: GridLineProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", {
          "grid-horizontal-line": orientation === "horizontal",
          "grid-vertical-line": orientation === "vertical",
          part: "grid-line",
        })}
        style={
          orientation === "vertical"
            ? { left: `${position}%` }
            : { top: `${position}%` }
        }
        {...props}
      />
    );
  }

  export interface CrosshairProps extends React.ComponentProps<"div"> {
    orientation: "vertical" | "horizontal";
  }

  export function Crosshair({
    className,
    orientation,
    ...props
  }: CrosshairProps) {
    const { thumbX, thumbY } = useValueContext();
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", {
          "crosshair-horizontal": orientation === "horizontal",
          "crosshair-vertical": orientation === "vertical",
          part: "crosshair",
        })}
        style={
          orientation === "vertical"
            ? { left: `${thumbX}%` }
            : { top: `${thumbY}%` }
        }
        {...props}
      />
    );
  }

  export interface CursorProps extends React.ComponentProps<"div"> {}

  export function Cursor({ className, ...props }: CursorProps) {
    const { thumbX, thumbY } = useValueContext();
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor" })}
        style={{
          left: `${thumbX}%`,
          top: `${thumbY}%`,
        }}
        {...props}
      />
    );
  }

  export interface CursorGlowProps extends React.ComponentProps<"div"> {}

  export function CursorGlow({ className, ...props }: CursorGlowProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor-glow" })}
        {...props}
      />
    );
  }

  export interface CursorDotProps extends React.ComponentProps<"div"> {}

  export function CursorDot({ className, ...props }: CursorDotProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor-dot" })}
        {...props}
      />
    );
  }

  export interface CursorHighlightProps extends React.ComponentProps<"div"> {}

  export function CursorHighlight({
    className,
    ...props
  }: CursorHighlightProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor-highlight" })}
        {...props}
      />
    );
  }

  export interface ValueDisplayProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    formatValue?: (value: Point) => React.ReactNode;
  }

  export function ValueDisplay({
    className,
    formatValue,
    ...props
  }: ValueDisplayProps) {
    const { value } = useValueContext();

    const content = formatValue ? (
      formatValue(value)
    ) : (
      <>
        <span {...getDataAttributes("xypad", { part: "value-x" })}>
          {value.x.toFixed(0)}
        </span>
        <span {...getDataAttributes("xypad", { part: "value-separator" })}>
          ,{" "}
        </span>
        <span {...getDataAttributes("xypad", { part: "value-y" })}>
          {value.y.toFixed(0)}
        </span>
      </>
    );

    return (
      <div
        aria-live="polite"
        className={className}
        {...getDataAttributes("xypad", { part: "value-display" })}
        {...props}
      >
        {content}
      </div>
    );
  }

  export interface LabelProps extends React.ComponentProps<"span"> {}

  export function Label({ className, ...props }: LabelProps) {
    const { elementId, value } = useContext();
    return (
      <span
        aria-live="polite"
        className={className}
        id={`${elementId}-label`}
        role="status"
        style={VISUALLY_HIDDEN_STYLE}
        {...props}
      >
        {`X: ${value.x.toFixed(1)}, Y: ${value.y.toFixed(1)}`}
      </span>
    );
  }
}
