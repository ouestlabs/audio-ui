import * as React from "react";
import { clamp, type Point as GeomPoint, type Nullable } from "../../../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "../../internal/event-details";
import { createPairFormatter } from "../../internal/format-pair";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useLocale } from "../../internal/use-locale";
import {
  EnvelopeContext,
  type EnvelopeContextValue,
  STATE_ATTRIBUTES_MAPPING,
} from "../context";
import {
  type Breakpoint,
  CURVE_EPSILON,
  clampToNeighbors,
  insertPoint,
  samePoints,
  sanitizePoints,
} from "../internal/geometry";

const DEFAULT_MIN_POINTS = 2;
const DEFAULT_STEP = 0.01;
/** How long a blocked-action signal (data-blocked) stays on before it clears, long enough for a feedback animation to play. */
const BLOCKED_DURATION_MS = 320;
/** ADSR-shaped: attack to peak, decay to a sustain plateau, release, reads as an envelope rather than a bare triangle. */
const DEFAULT_VALUE: Breakpoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

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
    snap = 0,
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
  const [focusedSegmentIndex, setFocusedSegmentIndex] = React.useState(0);
  const segmentElementsRef = React.useRef(new Map<number, HTMLElement>());
  const registerSegment = React.useCallback(
    (index: number, node: Nullable<HTMLElement>) => {
      if (node) {
        segmentElementsRef.current.set(index, node);
      } else {
        segmentElementsRef.current.delete(index);
      }
    },
    []
  );
  const focusSegment = React.useCallback((index: number) => {
    const last = Math.max(0, valueRef.current.length - 2);
    const target = Math.min(last, Math.max(0, index));
    setFocusedSegmentIndex(target);
    segmentElementsRef.current.get(target)?.focus();
  }, []);
  const [draggingSegmentIndex, setDraggingSegmentIndexState] = React.useState<
    number | null
  >(null);
  const [dragValue, setDragValue] = React.useState<Breakpoint[] | null>(null);
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

  const setDraggingSegment = React.useCallback((index: number | null) => {
    draggingRef.current = index !== null;
    setDraggingSegmentIndexState(index);
    if (index === null) {
      setDragValue(null);
    }
  }, []);

  const change = React.useCallback(
    (next: Breakpoint[], eventDetails: Root.ChangeEventDetails) => {
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
    (committed: Breakpoint[], eventDetails: Root.CommitEventDetails) => {
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
      next[index] = { ...base[index], ...clamped };
      return change(next, eventDetails);
    },
    [change]
  );

  const setCurve = React.useCallback(
    (index: number, curve: number, eventDetails: Root.ChangeEventDetails) => {
      const base = valueRef.current;
      const point = base[index];
      if (!(point && base[index + 1])) {
        return false;
      }
      const { curve: _previous, ...rest } = point;
      const bent = clamp(curve, -1, 1);
      const next = [...base];
      next[index] =
        Math.abs(bent) < CURVE_EPSILON ? rest : { ...rest, curve: bent };
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
      const { index, value: next } = insertPoint(base, point);
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
  const resolvedLocale = useLocale(locale);
  const formatPoint = React.useMemo(
    () => createPairFormatter(new Intl.NumberFormat(resolvedLocale, format)),
    [format, resolvedLocale]
  );

  const state = React.useMemo<Root.State>(
    () => ({
      disabled,
      dragging: draggingIndex !== null || draggingSegmentIndex !== null,
      value: displayedValue,
    }),
    [disabled, displayedValue, draggingIndex, draggingSegmentIndex]
  );

  const context = React.useMemo<EnvelopeContextValue>(
    () => ({
      actions: {
        addPoint,
        commit,
        focusSegment,
        movePoint,
        registerPoint,
        registerSegment,
        removePoint,
        setCurve,
        setDraggingIndex,
        setDraggingSegment,
        setFocusedIndex,
        setFocusedSegmentIndex,
      },
      meta: {
        blockedIndex,
        draggingIndex,
        draggingSegmentIndex,
        focusedIndex,
        focusedSegmentIndex,
        formatPoint,
        graphRef,
        isAddBlocked,
        minPoints,
        snap,
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
      draggingSegmentIndex,
      focusSegment,
      focusedIndex,
      focusedSegmentIndex,
      formatPoint,
      isAddBlocked,
      minPoints,
      movePoint,
      registerPoint,
      registerSegment,
      removePoint,
      setCurve,
      setDraggingIndex,
      setDraggingSegment,
      snap,
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
    value: Breakpoint[];
  };

  /** The affected point's index travels with every event. */
  type WithIndex<T> = T & { index: number };

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | WithIndex<ExtraChangeEventDetails<"drag", PointerEvent>>
    | WithIndex<ExtraChangeEventDetails<"keyboard", KeyboardEvent>>
    | WithIndex<ExtraChangeEventDetails<"add", MouseEvent>>
    | WithIndex<ExtraChangeEventDetails<"remove", MouseEvent | KeyboardEvent>>
    | WithIndex<
        ExtraChangeEventDetails<
          "curve",
          PointerEvent | KeyboardEvent | MouseEvent
        >
      >;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | WithIndex<ExtraCommitEventDetails<"drag", PointerEvent>>
    | WithIndex<ExtraCommitEventDetails<"keyboard", KeyboardEvent>>
    | WithIndex<ExtraCommitEventDetails<"add", MouseEvent>>
    | WithIndex<ExtraCommitEventDetails<"remove", MouseEvent | KeyboardEvent>>
    | WithIndex<
        ExtraCommitEventDetails<
          "curve",
          PointerEvent | KeyboardEvent | MouseEvent
        >
      >;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting points. Defaults to an ADSR-like shape. */
    defaultValue?: Breakpoint[];
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
      value: Breakpoint[],
      eventDetails: ChangeEventDetails
    ) => void;
    /** Fires when an interaction that changed the points ends. */
    onValueCommitted?: (
      value: Breakpoint[],
      eventDetails: CommitEventDetails
    ) => void;
    /** Grid the pointer snaps points to, in normalized units: 0.25 snaps to quarters, 0 is no grid. Holding Cmd/Ctrl leaves the grid, and Shift's fine drag ignores it. Keys move by `step`. @default 0 */
    snap?: number;
    /** Keyboard step on both axes, in normalized units. @default 0.01 */
    step?: number;
    value?: Breakpoint[];
  }
}
