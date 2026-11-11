import type {
  Breakpoint,
  EnvelopeChangeEventDetails,
  EnvelopeCommitEventDetails,
  EnvelopeSnap,
} from "@audio-ui/core/envelope";
import { createEnvelopeController } from "@audio-ui/core/envelope";
import type { Nullable } from "@audio-ui/core/internal";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useLocale } from "../../internal/use-locale.ts";
import {
  EnvelopeContext,
  type EnvelopeContextValue,
  STATE_ATTRIBUTES_MAPPING,
} from "../context.ts";

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
    defaultValue,
    disabled = false,
    format,
    locale,
    maxPoints,
    minPoints,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    snap,
    step,
    style,
    value,
    ...elementProps
  } = componentProps;
  const resolvedLocale = useLocale(locale);

  const [controller] = React.useState(() => createEnvelopeController());
  // Set on every render, before the snapshot is read, so it always shows the latest props.
  controller.setOptions({
    defaultValue,
    disabled,
    format,
    locale: resolvedLocale,
    maxPoints,
    minPoints,
    onValueChange,
    onValueCommitted,
    snap,
    step,
    value,
  });
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  React.useEffect(() => () => controller.dispose(), [controller]);

  // The roving tab stops and the elements they move focus to live with the view.
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [focusedSegmentIndex, setFocusedSegmentIndex] = React.useState(0);
  const pointElementsRef = React.useRef(new Map<number, HTMLElement>());
  const segmentElementsRef = React.useRef(new Map<number, HTMLElement>());
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
  const focusPoint = React.useCallback((index: number) => {
    setFocusedIndex(index);
    pointElementsRef.current.get(index)?.focus();
  }, []);
  const segmentCount = snapshot.value.length - 1;
  const focusSegment = React.useCallback(
    (index: number) => {
      const last = Math.max(0, segmentCount - 1);
      const target = Math.min(last, Math.max(0, index));
      setFocusedSegmentIndex(target);
      segmentElementsRef.current.get(target)?.focus();
    },
    [segmentCount]
  );

  const addPoint = React.useCallback(
    (at: { x: number; y: number }, event: MouseEvent) => {
      const index = controller.addPointAt(at, event);
      if (index !== null) {
        setFocusedIndex(index);
      }
    },
    [controller]
  );
  const removePoint = React.useCallback(
    (index: number, event: MouseEvent | KeyboardEvent) => {
      if (!controller.removePoint(index, event)) {
        return;
      }
      const remaining = controller.getSnapshot().value.length;
      focusPoint(Math.min(index, remaining - 1));
    },
    [controller, focusPoint]
  );

  const graphRef = React.useRef<SVGSVGElement>(null);

  const state = React.useMemo<Root.State>(
    () => ({
      disabled: snapshot.disabled,
      dragging: snapshot.dragging,
      value: snapshot.value,
    }),
    [snapshot]
  );

  const context = React.useMemo<EnvelopeContextValue>(
    () => ({
      addPoint,
      controller,
      focusPoint,
      focusSegment,
      focusedIndex,
      focusedSegmentIndex,
      graphRef,
      registerPoint,
      registerSegment,
      removePoint,
      setFocusedIndex,
      setFocusedSegmentIndex,
      snapshot,
      state,
    }),
    [
      addPoint,
      controller,
      focusPoint,
      focusSegment,
      focusedIndex,
      focusedSegmentIndex,
      registerPoint,
      registerSegment,
      removePoint,
      snapshot,
      state,
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

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = EnvelopeChangeEventDetails;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails = EnvelopeCommitEventDetails;

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
    /** Grid the pointer snaps points to, in normalized units: 0.25 snaps to quarters, 0 is no grid, and `{ x, y }` sets a step for each axis (`{ x: 0.125, y: 0 }` snaps across and leaves the level free). Holding Cmd/Ctrl leaves the grid, and Shift's fine drag ignores it. Keys move by `step`. @default 0 */
    snap?: EnvelopeSnap;
    /** Keyboard step on both axes, in normalized units. @default 0.01 */
    step?: number;
    value?: Breakpoint[];
  }
}
