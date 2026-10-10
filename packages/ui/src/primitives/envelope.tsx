import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import {
  clamp,
  clampUnit,
  type Point as GeomPoint,
  type Nullable,
} from "../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "./internal/event-details";
import { createPairFormatter } from "./internal/format-pair";
import { type PartProps, resolveStyling } from "./internal/part";

const DEFAULT_MIN_POINTS = 2;
const DEFAULT_STEP = 0.01;
/** Shift + arrows move this many steps at once. */
const LARGE_STEP_MULTIPLIER = 10;
/** How long a blocked-action signal (data-blocked) stays on before it clears, long enough for a feedback animation to play. */
const BLOCKED_DURATION_MS = 320;
/** ADSR-shaped: attack to peak, decay to a sustain plateau, release — reads as an envelope rather than a bare triangle. */
const DEFAULT_VALUE: GeomPoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

/** The points array and its indices stay in `state`; they don't become data attributes. */
const STATE_ATTRIBUTES_MAPPING = {
  value: () => null,
};

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

function samePoints(a: GeomPoint[], b: GeomPoint[]): boolean {
  return (
    a.length === b.length &&
    a.every((point, i) => point.x === b[i]?.x && point.y === b[i]?.y)
  );
}

/** Clamp a candidate point's x between its neighbors in `base` (so points can never cross or reorder) and y to [0,1]. */
function clampToNeighbors(
  base: GeomPoint[],
  index: number,
  next: GeomPoint
): Nullable<GeomPoint> {
  if (!base[index]) {
    return null;
  }
  const prev = base[index - 1];
  const nextNeighbor = base[index + 1];
  return {
    x: clamp(next.x, prev ? prev.x : 0, nextNeighbor ? nextNeighbor.x : 1),
    y: clampUnit(next.y),
  };
}

/** Polyline coordinates: flat lead-in from x=0 to the first point, the points themselves, flat lead-out from the last point to x=1. */
function polylinePoints(value: GeomPoint[]): string {
  const [first] = value;
  const last = value.at(-1);
  if (!(first && last)) {
    return "";
  }
  return [
    `0,${roundCoord((1 - first.y) * 100)}`,
    ...value.map(
      (point) =>
        `${roundCoord(point.x * 100)},${roundCoord((1 - point.y) * 100)}`
    ),
    `100,${roundCoord((1 - last.y) * 100)}`,
  ].join(" ");
}

interface EnvelopeContextValue {
  actions: {
    /** Add a point (normalized 0…1); blocked at `maxPoints`. */
    addPoint: (point: GeomPoint, event: MouseEvent) => void;
    commit: (value: GeomPoint[], eventDetails: Root.CommitEventDetails) => void;
    /** Move one point, clamped between its neighbors; returns whether it changed. */
    movePoint: (
      index: number,
      target: GeomPoint,
      eventDetails: Root.ChangeEventDetails
    ) => boolean;
    registerPoint: (index: number, node: Nullable<HTMLElement>) => void;
    /** Remove a point; blocked at `minPoints`. */
    removePoint: (index: number, event: MouseEvent | KeyboardEvent) => void;
    setDraggingIndex: (index: number | null) => void;
    setFocusedIndex: (index: number) => void;
  };
  meta: {
    blockedIndex: number | null;
    draggingIndex: number | null;
    /** The roving tab stop among the points. */
    focusedIndex: number;
    /** Formats a point's `x` and `y` as one string. */
    formatPoint: (x: number, y: number) => string;
    graphRef: React.RefObject<SVGSVGElement | null>;
    isAddBlocked: boolean;
    minPoints: number;
    step: number;
    /** Latest displayed value, readable from event handlers. */
    valueRef: React.RefObject<GeomPoint[]>;
  };
  state: Root.State;
}

const EnvelopeContext = React.createContext<EnvelopeContextValue | null>(null);

function useEnvelopeContext(part: string): EnvelopeContextValue {
  const context = React.use(EnvelopeContext);
  if (!context) {
    throw new Error(`Envelope.${part} must be used within Envelope.Root`);
  }
  return context;
}

/**
 * Groups all parts of the breakpoint envelope and owns its points, each
 * normalized to 0…1 on both axes and kept sorted by `x`. Points are dragged
 * and nudged with the keyboard; a double click on the `Graph` adds one and a
 * double click (or Delete) on a `Point` removes it, within `minPoints` /
 * `maxPoints`. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultValue = DEFAULT_VALUE,
    disabled = false,
    format,
    locale,
    maxPoints = Number.POSITIVE_INFINITY,
    minPoints = DEFAULT_MIN_POINTS,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    step = DEFAULT_STEP,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
    sanitizePoints(defaultValue)
  );
  const rawValue = isControlled ? valueProp : uncontrolledValue;
  const value = React.useMemo(() => sanitizePoints(rawValue), [rawValue]);

  // While a point is dragged, the envelope follows the pointer even if a
  // controlled value lags behind; on release the controlled value rules again.
  const [draggingIndex, setDraggingIndexState] = React.useState<number | null>(
    null
  );
  const [dragValue, setDragValue] = React.useState<GeomPoint[] | null>(null);
  const draggingRef = React.useRef(false);
  const displayedValue = dragValue ?? value;
  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  const setDraggingIndex = React.useCallback((index: number | null) => {
    draggingRef.current = index !== null;
    setDraggingIndexState(index);
    if (index === null) {
      setDragValue(null);
    }
  }, []);

  const change = React.useCallback(
    (next: GeomPoint[], eventDetails: Root.ChangeEventDetails) => {
      if (samePoints(next, valueRef.current)) {
        return false;
      }
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      valueRef.current = next;
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (isControlled && draggingRef.current) {
        setDragValue(next);
      }
      return true;
    },
    [isControlled, onValueChange]
  );

  const commit = React.useCallback(
    (committed: GeomPoint[], eventDetails: Root.CommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const pointElementsRef = React.useRef(new Map<number, HTMLElement>());
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

  // Blocked feedback: the attribute is cleared, then set on the next frame, so
  // it is observably removed and re-added and a CSS animation replays even
  // when the same action is blocked twice in a row.
  const [blockedIndex, setBlockedIndex] = React.useState<number | null>(null);
  const [isAddBlocked, setIsAddBlocked] = React.useState(false);
  const blockedTimeoutRef =
    React.useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
  const addBlockedTimeoutRef =
    React.useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
  React.useEffect(
    () => () => {
      if (blockedTimeoutRef.current) {
        clearTimeout(blockedTimeoutRef.current);
      }
      if (addBlockedTimeoutRef.current) {
        clearTimeout(addBlockedTimeoutRef.current);
      }
    },
    []
  );

  const signalBlockedPoint = React.useCallback((index: number) => {
    if (blockedTimeoutRef.current) {
      clearTimeout(blockedTimeoutRef.current);
    }
    setBlockedIndex(null);
    requestAnimationFrame(() => {
      setBlockedIndex(index);
      blockedTimeoutRef.current = setTimeout(() => {
        setBlockedIndex(null);
      }, BLOCKED_DURATION_MS);
    });
  }, []);

  const signalAddBlocked = React.useCallback(() => {
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

  const movePoint = React.useCallback(
    (
      index: number,
      target: GeomPoint,
      eventDetails: Root.ChangeEventDetails
    ) => {
      const base = valueRef.current;
      const clamped = clampToNeighbors(base, index, target);
      if (!clamped) {
        return false;
      }
      const next = [...base];
      next[index] = clamped;
      return change(next, eventDetails);
    },
    [change]
  );

  const addPoint = React.useCallback(
    (point: GeomPoint, event: MouseEvent) => {
      if (disabled) {
        return;
      }
      const base = valueRef.current;
      if (base.length >= maxPoints) {
        signalAddBlocked();
        return;
      }
      const added = { x: clampUnit(point.x), y: clampUnit(point.y) };
      const next = sortPoints([...base, added]);
      const index = next.indexOf(added);
      const eventDetails = Object.assign(
        createChangeEventDetails("add", event),
        { index }
      );
      if (change(next, eventDetails)) {
        commit(next, { event, index, reason: "add" });
        setFocusedIndex(index);
      }
    },
    [change, commit, disabled, maxPoints, signalAddBlocked]
  );

  const removePoint = React.useCallback(
    (index: number, event: MouseEvent | KeyboardEvent) => {
      if (disabled) {
        return;
      }
      const base = valueRef.current;
      if (base.length <= minPoints) {
        signalBlockedPoint(index);
        return;
      }
      const next = base.filter((_, i) => i !== index);
      const eventDetails = Object.assign(
        createChangeEventDetails("remove", event),
        { index }
      );
      if (change(next, eventDetails)) {
        commit(next, { event, index, reason: "remove" });
        const focusTarget = Math.min(index, next.length - 1);
        setFocusedIndex(focusTarget);
        pointElementsRef.current.get(focusTarget)?.focus();
      }
    },
    [change, commit, disabled, minPoints, signalBlockedPoint]
  );

  const graphRef = React.useRef<SVGSVGElement>(null);
  const formatPoint = React.useMemo(
    () => createPairFormatter(new Intl.NumberFormat(locale, format)),
    [format, locale]
  );

  const state = React.useMemo<Root.State>(
    () => ({
      disabled,
      dragging: draggingIndex !== null,
      value: displayedValue,
    }),
    [disabled, displayedValue, draggingIndex]
  );

  const context = React.useMemo<EnvelopeContextValue>(
    () => ({
      actions: {
        addPoint,
        commit,
        movePoint,
        registerPoint,
        removePoint,
        setDraggingIndex,
        setFocusedIndex,
      },
      meta: {
        blockedIndex,
        draggingIndex,
        focusedIndex,
        formatPoint,
        graphRef,
        isAddBlocked,
        minPoints,
        step,
        valueRef,
      },
      state,
    }),
    [
      addPoint,
      blockedIndex,
      commit,
      draggingIndex,
      focusedIndex,
      formatPoint,
      isAddBlocked,
      minPoints,
      movePoint,
      registerPoint,
      removePoint,
      setDraggingIndex,
      state,
      step,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { position: "relative" } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });

  return <EnvelopeContext value={context}>{element}</EnvelopeContext>;
}

export namespace Root {
  export type State = {
    disabled: boolean;
    /** Whether a point is being dragged. */
    dragging: boolean;
    value: GeomPoint[];
  };

  /** The affected point's index travels with every event. */
  type WithIndex<T> = T & { index: number };

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | WithIndex<ExtraChangeEventDetails<"drag", PointerEvent>>
    | WithIndex<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
    | WithIndex<ExtraChangeEventDetails<"add", MouseEvent>>
    | WithIndex<ExtraChangeEventDetails<"remove", MouseEvent | KeyboardEvent>>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | WithIndex<ExtraCommitEventDetails<"drag", PointerEvent>>
    | WithIndex<ExtraCommitEventDetails<"keyboard", KeyboardEvent>>
    | WithIndex<ExtraCommitEventDetails<"add", MouseEvent>>
    | WithIndex<ExtraCommitEventDetails<"remove", MouseEvent | KeyboardEvent>>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting points. Defaults to an ADSR-like shape. */
    defaultValue?: GeomPoint[];
    disabled?: boolean;
    /** Formats point coordinates for each point's `aria-valuetext`. */
    format?: Intl.NumberFormatOptions;
    locale?: Intl.LocalesArgument;
    /** Ceiling on the number of points; adding is blocked at this count. Equal to `minPoints`, the shape is fixed. */
    maxPoints?: number;
    /** Floor on the number of points; removal is blocked at this count. @default 2 */
    minPoints?: number;
    /** Fires on every change: drag, keyboard, add and remove. */
    onValueChange?: (
      value: GeomPoint[],
      eventDetails: ChangeEventDetails
    ) => void;
    /** Fires when an interaction that changed the points ends. */
    onValueCommitted?: (
      value: GeomPoint[],
      eventDetails: CommitEventDetails
    ) => void;
    /** Keyboard step on both axes, in normalized units. @default 0.01 */
    step?: number;
    value?: GeomPoint[];
  }
}

/**
 * The drawing surface, a 100×100 stretched viewBox: holds `Line` and `Fill`,
 * and a double click on it adds a point. Carries `data-blocked` briefly when
 * adding is refused at `maxPoints`. Renders an `<svg>` element.
 */
export function Graph(componentProps: Graph.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useEnvelopeContext("Graph");
  const graphState = React.useMemo<Graph.State>(
    () => ({ ...state, blocked: meta.isAddBlocked }),
    [meta.isAddBlocked, state]
  );

  const handleDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    actions.addPoint(
      {
        x: (event.clientX - rect.left) / rect.width,
        y: 1 - (event.clientY - rect.top) / rect.height,
      },
      event.nativeEvent
    );
  };

  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        onDoubleClick: handleDoubleClick,
        preserveAspectRatio: "none",
        viewBox: "0 0 100 100",
      },
      { ...elementProps, ...resolveStyling(className, style, graphState) }
    ),
    ref: ref ? [ref, meta.graphRef] : meta.graphRef,
    render,
    state: graphState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Graph {
  export type State = Root.State & {
    /** Briefly true after an add was refused at `maxPoints`. */
    blocked: boolean;
  };
  export type Props = PartProps<"svg", State>;
}

/** The envelope curve through the points. Renders a `<polyline>` element. */
export function Line(componentProps: Line.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useEnvelopeContext("Line");
  return useRender({
    defaultTagName: "polyline",
    props: mergeProps<"polyline">(
      {
        fill: "none",
        points: polylinePoints(state.value),
        style: { vectorEffect: "non-scaling-stroke" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Line {
  export type State = Root.State;
  export type Props = PartProps<"polyline", State>;
}

/** The area under the curve. Renders a `<polyline>` element. */
export function Fill(componentProps: Fill.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useEnvelopeContext("Fill");
  const points = polylinePoints(state.value);
  return useRender({
    defaultTagName: "polyline",
    props: mergeProps<"polyline">(
      { points: points ? `${points} 100,100 0,100` : "" },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Fill {
  export type State = Root.State;
  export type Props = PartProps<"polyline", State>;
}

/** Renders one child per point, in `x` order. */
export function Points({ children }: Points.Props) {
  const { state } = useEnvelopeContext("Points");
  return (
    <>
      {state.value.map((point, index) => children(point, index, state.value))}
    </>
  );
}

export namespace Points {
  export interface Props {
    children: (
      point: GeomPoint,
      index: number,
      points: GeomPoint[]
    ) => React.ReactNode;
  }
}

interface PointGesture {
  /** Whether the gesture moved the point at least once; if so its end commits. */
  changed: boolean;
  pointerId: number;
}

/**
 * A draggable handle for the point at `index`, positioned with `left`/`bottom`
 * percentages over the `Graph`. It is a `role="slider"` on the point's level
 * (`y`): give it an `aria-label`. One point at a time is the tab stop; arrow
 * keys move it (Shift for larger steps), Delete or a double click removes it.
 * Carries `data-blocked` briefly when removal is refused at `minPoints`.
 * Renders a `<div>` element.
 */
export function Point(componentProps: Point.Props) {
  const {
    className,
    getAriaValueText,
    index,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useEnvelopeContext("Point");
  const point = state.value[index];
  const gestureRef = React.useRef<PointGesture | null>(null);

  const pointState = React.useMemo<Point.State>(
    () => ({
      blocked: meta.blockedIndex === index,
      disabled: state.disabled,
      dragging: meta.draggingIndex === index,
      index,
      removable: state.value.length > meta.minPoints,
      value: state.value,
    }),
    [
      index,
      meta.blockedIndex,
      meta.draggingIndex,
      meta.minPoints,
      state.disabled,
      state.value,
    ]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus({ focusVisible: false, preventScroll: true });
    gestureRef.current = { changed: false, pointerId: event.pointerId };
    actions.setFocusedIndex(index);
    actions.setDraggingIndex(index);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const graph = meta.graphRef.current;
    if (!(gesture && graph) || gesture.pointerId !== event.pointerId) {
      return;
    }
    const rect = graph.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const moved = actions.movePoint(
      index,
      {
        x: (event.clientX - rect.left) / rect.width,
        y: 1 - (event.clientY - rect.top) / rect.height,
      },
      Object.assign(createChangeEventDetails("drag", event.nativeEvent), {
        index,
      })
    );
    if (moved) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    actions.setDraggingIndex(null);
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, {
        event: event.nativeEvent,
        index,
        reason: "drag",
      });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    actions.removePoint(index, event.nativeEvent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = meta.valueRef.current[index];
    if (state.disabled || !current) {
      return;
    }
    const native = event.nativeEvent;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      actions.removePoint(index, native);
      return;
    }
    const distance = meta.step * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
    const targets: Record<string, GeomPoint> = {
      ArrowDown: { x: current.x, y: current.y - distance },
      ArrowLeft: { x: current.x - distance, y: current.y },
      ArrowRight: { x: current.x + distance, y: current.y },
      ArrowUp: { x: current.x, y: current.y + distance },
    };
    const target = targets[event.key];
    if (!target) {
      return;
    }
    event.preventDefault();
    const moved = actions.movePoint(
      index,
      target,
      Object.assign(createChangeEventDetails("keyboard", native), { index })
    );
    if (moved) {
      actions.commit(meta.valueRef.current, {
        event: native,
        index,
        reason: "keyboard",
      });
    }
  };

  const { registerPoint } = actions;
  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => registerPoint(index, node),
    [index, registerPoint]
  );

  const resolved = resolveStyling(className, style, pointState);
  // Centering stays in `transform` so a feedback animation can use the
  // standalone `translate` property without fighting it.
  const baseTransform = "translate(-50%, 50%)";

  return useRender({
    defaultTagName: "div",
    enabled: Boolean(point),
    props: mergeProps<"div">(
      {
        "aria-disabled": state.disabled || undefined,
        "aria-valuemax": 1,
        "aria-valuemin": 0,
        "aria-valuenow": point?.y,
        "aria-valuetext": point
          ? (getAriaValueText?.(point, index) ??
            meta.formatPoint(point.x, point.y))
          : undefined,
        onDoubleClick: handleDoubleClick,
        onFocus: () => actions.setFocusedIndex(index),
        onKeyDown: handleKeyDown,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        role: "slider",
        tabIndex: state.disabled || index !== meta.focusedIndex ? -1 : 0,
      },
      {
        ...elementProps,
        className: resolved.className,
        style: {
          bottom: `${(point?.y ?? 0) * 100}%`,
          left: `${(point?.x ?? 0) * 100}%`,
          position: "absolute",
          touchAction: "none",
          ...resolved.style,
          transform: resolved.style?.transform
            ? `${baseTransform} ${resolved.style.transform}`
            : baseTransform,
        },
      }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
    state: pointState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Point {
  export type State = Root.State & {
    /** Briefly true after a removal was refused at `minPoints`. */
    blocked: boolean;
    index: number;
    /** Whether the point can currently be removed. */
    removable: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** Returns the point's `aria-valuetext`. Defaults to the formatted `x, y`. */
    getAriaValueText?: (point: GeomPoint, index: number) => string;
    /** Index of the point in the (sorted) value. */
    index: number;
  }
}
