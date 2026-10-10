import * as React from "react";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import type { Nullable, Point, Procedure } from "../utils";
import { clamp, panic } from "../utils";
import { getDataAttributes } from "./internal/data-attributes";
import { useParameterCore } from "./internal/use-parameter-core";

const DEFAULT_TOTAL_STEPS = 16;
const DEFAULT_MIN_LENGTH = 1;
/** Matches PianoRoll's own threshold: below it a press-release is a click (seek), not a drag (region create/move/resize). */
const DRAG_THRESHOLD_PX = 4;

function exceedsDragThreshold(origin: Point, current: Point): boolean {
  const dx = current.x - origin.x;
  return dx * dx >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
}

export namespace Ruler {
  /** A step range, `end` exclusive — mirrors `startStep`/`duration` elsewhere in the grid-step vocabulary, just pre-added into bounds. Null means "no region set"; a consumer typically treats that as looping/spanning the whole timeline. */
  export interface Region {
    end: number;
    start: number;
  }

  interface Domain {
    minLength: number;
    totalSteps: number;
  }

  function sanitizeRegion(
    region: Nullable<Region>,
    domain: Domain
  ): Nullable<Region> {
    if (!region) {
      return null;
    }
    const start = clamp(
      Math.round(region.start),
      0,
      domain.totalSteps - domain.minLength
    );
    const end = clamp(
      Math.round(region.end),
      start + domain.minLength,
      domain.totalSteps
    );
    return { end, start };
  }

  /** "create" extends a freshly-anchored region in either direction, mirroring PianoRoll's "paint" — the other two modes anchor one edge of the existing region. */
  type DragMode = "create" | "move" | "resize-end" | "resize-start";

  interface DragOrigin {
    anchorStep: number;
    mode: DragMode;
    point: Point;
    region: Region;
  }

  interface ConfigContextValue {
    ariaLabel?: string;
    ariaLabelledBy?: string;
    beginRegionDrag: (mode: DragMode, point: Point, anchorStep: number) => void;
    clearRegion: () => void;
    commitRegionDrag: () => void;
    createDefaultRegion: () => void;
    disabled: boolean;
    domain: Domain;
    dragRegionTo: (point: Point) => void;
    elementId: string;
    nudgeRegion: (deltaStep: number) => void;
    onSeek?: Procedure<number>;
    resizeRegionEnd: (deltaStep: number) => void;
    trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  }

  /** Split from config: changes every drag frame, so only components that render the live region subscribe to it. */
  interface ValueContextValue {
    value: Nullable<Region>;
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("Ruler components must be used within Ruler.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("Ruler components must be used within Ruler.Root");
    }
    return context;
  }

  export interface RootProps
    extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: Nullable<Region>;
    disabled?: boolean;
    /** Floor on a region's length, in steps. */
    minLength?: number;
    /** Fires on a plain click (press-release under the drag threshold) at the clicked step — drag instead to set a region. */
    onSeek?: Procedure<number>;
    onValueChange?: Procedure<Nullable<Region>>;
    onValueCommit?: Procedure<Nullable<Region>>;
    /** Width of the timeline, in grid steps — should match the grid this ruler sits above. */
    totalSteps?: number;
    value?: Nullable<Region>;
  }

  export function Root({
    value: controlledValue,
    defaultValue = null,
    totalSteps = DEFAULT_TOTAL_STEPS,
    minLength = DEFAULT_MIN_LENGTH,
    disabled = false,
    onSeek,
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
    const dragOriginRef = React.useRef<Nullable<DragOrigin>>(null);

    const domain = React.useMemo<Domain>(
      () => ({ minLength, totalSteps }),
      [minLength, totalSteps]
    );

    const clampStep = React.useCallback(
      (next: Nullable<Region>) => sanitizeRegion(next, domain),
      [domain]
    );

    const { beginDrag, commitValue, dragTo, endDrag, value, valueRef } =
      useParameterCore<Nullable<Region>>({
        clampStep,
        defaultValue: sanitizeRegion(defaultValue, domain),
        disabled,
        fallbackValue: sanitizeRegion(defaultValue, domain),
        onValueChange,
        onValueCommit,
        transform: clampStep,
        value: controlledValue,
      });

    const beginRegionDrag = React.useCallback(
      (mode: DragMode, point: Point, anchorStep: number) => {
        if (disabled) {
          return;
        }
        const existingRegion = valueRef.current;
        const region: Region =
          mode === "create"
            ? { end: anchorStep + minLength, start: anchorStep }
            : (existingRegion ?? {
                end: anchorStep + minLength,
                start: anchorStep,
              });
        dragOriginRef.current = { anchorStep, mode, point, region };
        beginDrag(region);
      },
      [beginDrag, disabled, minLength, valueRef]
    );

    const dragRegionTo = React.useCallback(
      (point: Point) => {
        const origin = dragOriginRef.current;
        const track = trackRef.current;
        if (!(origin && track)) {
          return;
        }
        const rect = track.getBoundingClientRect();
        if (rect.width <= 0) {
          return;
        }
        let deltaStep = Math.round(
          ((point.x - origin.point.x) / rect.width) * domain.totalSteps
        );
        const { region } = origin;
        let next: Region;

        if (origin.mode === "move") {
          deltaStep = clamp(
            deltaStep,
            -region.start,
            domain.totalSteps - region.end
          );
          next = {
            end: region.end + deltaStep,
            start: region.start + deltaStep,
          };
        } else if (origin.mode === "resize-end") {
          deltaStep = clamp(
            deltaStep,
            domain.minLength - (region.end - region.start),
            domain.totalSteps - region.end
          );
          next = { end: region.end + deltaStep, start: region.start };
        } else if (origin.mode === "resize-start") {
          deltaStep = clamp(
            deltaStep,
            -region.start,
            region.end - domain.minLength - region.start
          );
          next = { end: region.end, start: region.start + deltaStep };
        } else {
          // create: the anchor step can extend the region either direction,
          // bounded only by the grid's own edges.
          const { anchorStep } = origin;
          deltaStep = clamp(
            deltaStep,
            -anchorStep,
            domain.totalSteps - 1 - anchorStep
          );
          const currentStep = anchorStep + deltaStep;
          const start = Math.min(anchorStep, currentStep);
          const end = Math.max(
            start + domain.minLength,
            Math.max(anchorStep, currentStep) + 1
          );
          next = { end, start };
        }

        dragTo(next);
      },
      [domain, dragTo]
    );

    const commitRegionDrag = React.useCallback(() => {
      dragOriginRef.current = null;
      endDrag();
    }, [endDrag]);

    const clearRegion = React.useCallback(() => {
      if (disabled) {
        return;
      }
      commitValue(null);
    }, [commitValue, disabled]);

    const createDefaultRegion = React.useCallback(() => {
      if (disabled || valueRef.current) {
        return;
      }
      commitValue({ end: minLength, start: 0 });
    }, [commitValue, disabled, minLength, valueRef]);

    /** Arrow-key move: shifts both edges by the same step delta, clamped so the region's length never changes and it never crosses the grid's own edges. */
    const nudgeRegion = React.useCallback(
      (deltaStepInput: number) => {
        if (disabled) {
          return;
        }
        const region = valueRef.current;
        if (!region) {
          return;
        }
        const deltaStep = clamp(
          deltaStepInput,
          -region.start,
          domain.totalSteps - region.end
        );
        commitValue({
          end: region.end + deltaStep,
          start: region.start + deltaStep,
        });
      },
      [commitValue, disabled, domain, valueRef]
    );

    /** Shift+arrow resize: only the end edge moves, floored at `minLength` — the start edge stays a pointer-only affordance via `LoopRegionHandle side="start"`, same split as PianoRoll's `Note`/`NoteHandle`. */
    const resizeRegionEnd = React.useCallback(
      (deltaStepInput: number) => {
        if (disabled) {
          return;
        }
        const region = valueRef.current;
        if (!region) {
          return;
        }
        const deltaStep = clamp(
          deltaStepInput,
          domain.minLength - (region.end - region.start),
          domain.totalSteps - region.end
        );
        commitValue({ end: region.end + deltaStep, start: region.start });
      },
      [commitValue, disabled, domain, valueRef]
    );

    const elementId = id || rootId;

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        ariaLabel,
        ariaLabelledBy,
        beginRegionDrag,
        clearRegion,
        commitRegionDrag,
        createDefaultRegion,
        disabled,
        domain,
        dragRegionTo,
        elementId,
        nudgeRegion,
        onSeek,
        resizeRegionEnd,
        trackRef,
      }),
      [
        ariaLabel,
        ariaLabelledBy,
        beginRegionDrag,
        clearRegion,
        commitRegionDrag,
        createDefaultRegion,
        disabled,
        domain,
        dragRegionTo,
        elementId,
        nudgeRegion,
        onSeek,
        resizeRegionEnd,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ value }),
      [value]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("ruler", { disabled, part: "ruler-wrapper" })}
            style={{ position: "relative", ...style }}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Timeline ruler
              </span>
            )}
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface TrackProps extends React.ComponentProps<"div"> {}

  /** Click to seek (a plain press-release under the drag threshold), or drag to draw a loop region spanning the dragged steps. Press/move/release on the region itself (or its handles) is handled by `LoopRegion`/`LoopRegionHandle`, not here — this only ever sees empty track space. */
  export function Track({
    className,
    style,
    onKeyDown,
    onPointerDown,
    ...props
  }: TrackProps) {
    const {
      ariaLabel,
      ariaLabelledBy,
      beginRegionDrag,
      commitRegionDrag,
      createDefaultRegion,
      disabled,
      domain,
      dragRegionTo,
      elementId,
      onSeek,
      trackRef,
    } = useConfigContext();

    const pressRef =
      React.useRef<
        Nullable<{
          anchorStep: number;
          origin: Point;
          started: boolean;
        }>
      >(null);

    const stepFromPoint = React.useCallback(
      (clientX: number, rect: DOMRect): number =>
        clamp(
          Math.floor(((clientX - rect.left) / rect.width) * domain.totalSteps),
          0,
          domain.totalSteps - 1
        ),
      [domain]
    );

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        onPointerDown?.(e);
        if (disabled || e.target !== e.currentTarget) {
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) {
          return;
        }
        const origin = { x: e.clientX, y: e.clientY };
        const anchorStep = stepFromPoint(e.clientX, rect);
        e.currentTarget.setPointerCapture(e.pointerId);
        pressRef.current = { anchorStep, origin, started: false };
      },
      [disabled, onPointerDown, stepFromPoint]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const press = pressRef.current;
        if (!press) {
          return;
        }
        const point = { x: e.clientX, y: e.clientY };
        if (!press.started) {
          if (!exceedsDragThreshold(press.origin, point)) {
            return;
          }
          press.started = true;
          beginRegionDrag("create", press.origin, press.anchorStep);
        }
        dragRegionTo(point);
      },
      [beginRegionDrag, dragRegionTo]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const press = pressRef.current;
        if (!press) {
          return;
        }
        pressRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (press.started) {
          commitRegionDrag();
        } else {
          onSeek?.(press.anchorStep);
        }
      },
      [commitRegionDrag, onSeek]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (disabled || e.target !== e.currentTarget) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          createDefaultRegion();
        }
      },
      [createDefaultRegion, disabled, onKeyDown]
    );

    return (
      <div
        aria-label={ariaLabel || "Timeline ruler"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        {...getDataAttributes("ruler", { disabled, part: "track" })}
        className={className}
        id={`${elementId}-track`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={trackRef}
        role="group"
        style={{ position: "relative", touchAction: "none", ...style }}
        tabIndex={disabled ? -1 : 0}
        {...props}
      />
    );
  }

  export interface LoopRegionProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    children?: React.ReactNode;
  }

  /** The set loop region's body — drag to move it, double-click or press Delete/Backspace (while focused) to clear it back to "no region", arrow keys nudge it a step at a time, and Shift+Left/Right resizes its end edge (its start edge is a pointer-only affordance via `LoopRegionHandle side="start"`, the same split PianoRoll's `Note`/`NoteHandle` use). Renders nothing when no region is set. */
  export function LoopRegion({
    className,
    children,
    onDoubleClick,
    ...props
  }: LoopRegionProps) {
    const {
      beginRegionDrag,
      clearRegion,
      commitRegionDrag,
      disabled,
      domain,
      dragRegionTo,
      elementId,
      nudgeRegion,
      resizeRegionEnd,
    } = useConfigContext();
    const { value } = useValueContext();

    const dragStateRef =
      React.useRef<
        Nullable<{
          origin: Point;
          started: boolean;
        }>
      >(null);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus();
        dragStateRef.current = {
          origin: { x: e.clientX, y: e.clientY },
          started: false,
        };
      },
      [disabled]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        const point = { x: e.clientX, y: e.clientY };
        if (!drag.started) {
          if (!exceedsDragThreshold(drag.origin, point)) {
            return;
          }
          drag.started = true;
          beginRegionDrag("move", drag.origin, 0);
        }
        dragRegionTo(point);
      },
      [beginRegionDrag, dragRegionTo]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        dragStateRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (drag.started) {
          commitRegionDrag();
        }
      },
      [commitRegionDrag]
    );

    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        onDoubleClick?.(e);
        if (disabled) {
          return;
        }
        e.stopPropagation();
        clearRegion();
      },
      [clearRegion, disabled, onDoubleClick]
    );

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowLeft: (e) => {
          if (e.shiftKey) {
            resizeRegionEnd(-1);
          } else {
            nudgeRegion(-1);
          }
          return true;
        },
        onArrowRight: (e) => {
          if (e.shiftKey) {
            resizeRegionEnd(1);
          } else {
            nudgeRegion(1);
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
          clearRegion();
        }
      },
    });

    if (!value) {
      return null;
    }

    return (
      <div
        aria-label={`Loop region, step ${value.start + 1} to ${value.end}`}
        {...getDataAttributes("ruler", { disabled, part: "loop-region" })}
        className={className}
        id={`${elementId}-region`}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="group"
        style={{
          left: `${(value.start / domain.totalSteps) * 100}%`,
          position: "absolute",
          width: `${((value.end - value.start) / domain.totalSteps) * 100}%`,
        }}
        tabIndex={disabled ? -1 : 0}
        {...keyboardProps}
        {...props}
      >
        {children}
      </div>
    );
  }

  export interface LoopRegionHandleProps extends React.ComponentProps<"div"> {
    /** Dragging "end" (the default) keeps the region's start fixed and changes where it ends; dragging "start" keeps the region's end fixed and trims from the front. */
    side?: "end" | "start";
  }

  /** An edge drag handle for resizing the loop region. Keyboard users resize the end via Shift+ArrowLeft/Right on `LoopRegion` itself, so this handle is a pointer-only affordance and stays out of the accessibility tree — the same split PianoRoll's `NoteHandle` uses. */
  export function LoopRegionHandle({
    className,
    side = "end",
    style,
    ...props
  }: LoopRegionHandleProps) {
    const { beginRegionDrag, commitRegionDrag, disabled, dragRegionTo } =
      useConfigContext();
    const dragStateRef =
      React.useRef<
        Nullable<{
          origin: Point;
          started: boolean;
        }>
      >(null);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
          origin: { x: e.clientX, y: e.clientY },
          started: false,
        };
      },
      [disabled]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        const point = { x: e.clientX, y: e.clientY };
        if (!drag.started) {
          if (!exceedsDragThreshold(drag.origin, point)) {
            return;
          }
          drag.started = true;
          beginRegionDrag(
            side === "start" ? "resize-start" : "resize-end",
            drag.origin,
            0
          );
        }
        dragRegionTo(point);
      },
      [beginRegionDrag, dragRegionTo, side]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        dragStateRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (drag.started) {
          commitRegionDrag();
        }
      },
      [commitRegionDrag]
    );

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("ruler", {
          disabled,
          part: "loop-region-handle",
          side,
        })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: "absolute", ...style }}
        {...props}
      />
    );
  }

  export interface PlayheadProps extends React.ComponentProps<"div"> {}

  /** A purely decorative positioned marker, same contract as `PianoRoll.Playhead`: playback position updates at animation-frame rate, far too fast for React state — pass a `ref` and mutate `style.left` imperatively from your own scheduling loop. */
  export function Playhead({ className, style, ...props }: PlayheadProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("ruler", { part: "playhead" })}
        style={{ pointerEvents: "none", position: "absolute", ...style }}
        {...props}
      />
    );
  }
}
