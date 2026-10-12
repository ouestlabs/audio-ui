import type { Source } from "@audio-ui/core";
import {
  type CellAddress,
  cellKey,
  createSequencerController,
  type SequencerOptions,
  type Velocities,
} from "@audio-ui/core/sequencer";
import * as React from "react";
import { shallowEqual } from "../../internal/equal.ts";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  SequencerContext,
  type SequencerContextValue,
  type SequencerState,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
  type VelocityChangeEventDetails,
  type VelocityCommitEventDetails,
} from "../context.ts";

/**
 * A grid of steps to switch on and off, one row per sound: the pattern of a
 * drum machine. Pressing a cell flips it, and dragging on carries the new
 * state across every cell the pointer crosses. The cells are one tab stop, and
 * the arrow keys move between them. The step being played comes from `source`
 * and is marked on its cells straight in the DOM with `data-current`, so a
 * clock ticking every step never re-renders React. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultValue,
    defaultVelocities,
    disabled = false,
    onValueChange,
    onValueCommitted,
    onVelocityChange,
    onVelocityCommitted,
    ref,
    render,
    source,
    style,
    value,
    velocities,
    ...elementProps
  } = componentProps;

  const options: SequencerOptions = {
    defaultValue,
    defaultVelocities,
    disabled,
    onValueChange,
    onValueCommitted,
    onVelocityChange,
    onVelocityCommitted,
    value,
    velocities,
  };
  const [controller] = React.useState(() => createSequencerController(options));
  // Set on every render, so the sequencer always reads the latest props.
  controller.setOptions(options);

  const rootRef = React.useRef<HTMLElement | null>(null);
  const cellNodes = React.useRef(new Map<string, HTMLElement>()).current;
  const velocityNodes = React.useRef(new Map<string, HTMLElement>()).current;

  // The shape and the state of the grid: Root re-renders on these, and not on
  // each cell pressed, which only the cells showing it render for.
  const lastShape = React.useRef<{
    disabled: boolean;
    painting: boolean;
    rows: number;
    steps: number;
  } | null>(null);
  const readShape = React.useCallback(() => {
    const view = controller.getSnapshot();
    const next = {
      disabled: view.disabled,
      painting: view.painting,
      rows: view.rows,
      steps: view.steps,
    };
    if (lastShape.current && shallowEqual(lastShape.current, next)) {
      return lastShape.current;
    }
    lastShape.current = next;
    return next;
  }, [controller]);
  const shape = React.useSyncExternalStore(
    controller.subscribe,
    readShape,
    readShape
  );
  const { painting, rows, steps } = shape;

  const registerCell = React.useCallback(
    (cell: CellAddress, node: HTMLElement | null) => {
      if (node) {
        cellNodes.set(cellKey(cell), node);
      } else {
        cellNodes.delete(cellKey(cell));
      }
    },
    [cellNodes]
  );

  const registerVelocity = React.useCallback(
    (cell: CellAddress, node: HTMLElement | null) => {
      if (node) {
        velocityNodes.set(cellKey(cell), node);
      } else {
        velocityNodes.delete(cellKey(cell));
      }
    },
    [velocityNodes]
  );

  const focusCell = React.useCallback(
    (cell: CellAddress) => {
      cellNodes.get(cellKey(cell))?.focus({ preventScroll: true });
    },
    [cellNodes]
  );

  // The step being played is painted on its cells without a render.
  const currentRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!source) {
      return;
    }
    const mark = (step: number | null, on: boolean) => {
      if (step === null) {
        return;
      }
      for (const [key, node] of cellNodes) {
        if (key.endsWith(`:${step}`)) {
          if (on) {
            node.setAttribute("data-current", "");
          } else {
            node.removeAttribute("data-current");
          }
        }
      }
    };
    const follow = () => {
      const step = source.getSnapshot();
      const next = step >= 0 && step < steps ? Math.floor(step) : null;
      if (next !== currentRef.current) {
        mark(currentRef.current, false);
        mark(next, true);
        currentRef.current = next;
      }
    };
    follow();
    const unsubscribe = source.subscribe(follow);
    return () => {
      unsubscribe();
      mark(currentRef.current, false);
      currentRef.current = null;
    };
  }, [cellNodes, source, steps]);

  const state = React.useMemo<Root.State>(
    () => ({ disabled: shape.disabled, painting }),
    [painting, shape.disabled]
  );

  // The cells carry `data-painting` too, written straight to them: reading it
  // in each cell would render the whole grid at every press and release.
  React.useLayoutEffect(() => {
    for (const node of cellNodes.values()) {
      node.toggleAttribute("data-painting", painting);
    }
  }, [cellNodes, painting]);

  const context = React.useMemo<SequencerContextValue>(
    () => ({
      cellNodes,
      controller,
      focusCell,
      meta: { rows, steps },
      registerCell,
      registerVelocity,
      rootRef,
      state: { disabled: shape.disabled },
      velocityNodes,
    }),
    [
      cellNodes,
      controller,
      focusCell,
      registerCell,
      registerVelocity,
      rows,
      shape.disabled,
      steps,
      velocityNodes,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        role: "group",
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, rootRef] : rootRef,
    render,
    state,
  });
  return <SequencerContext value={context}>{element}</SequencerContext>;
}

export namespace Root {
  export type State = SequencerState;
  export type Pattern = readonly (readonly boolean[])[];
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = ValueChangeEventDetails;
  export type CommitEventDetails = ValueCommitEventDetails;
  export type VelocityChangeDetails = VelocityChangeEventDetails;
  export type VelocityCommitDetails = VelocityCommitEventDetails;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting pattern: a row per sound, each a list of steps. */
    defaultValue?: Pattern;
    /** Uncontrolled starting velocities. */
    defaultVelocities?: Velocities;
    disabled?: boolean;
    /** Fires while cells are flipped. `eventDetails.cancel()` keeps the pattern as it was. */
    onValueChange?: (
      value: boolean[][],
      eventDetails: ChangeEventDetails
    ) => void;
    /** Fires when a press, a paint or a key press that changed the pattern ends. */
    onValueCommitted?: (
      value: boolean[][],
      eventDetails: CommitEventDetails
    ) => void;
    /** Fires while a velocity is drawn or nudged. `eventDetails.cancel()` keeps the velocities as they were. */
    onVelocityChange?: (
      velocities: number[][],
      eventDetails: VelocityChangeEventDetails
    ) => void;
    /** Fires when a drag, a key press or a reset that changed a velocity ends. */
    onVelocityCommitted?: (
      velocities: number[][],
      eventDetails: VelocityCommitEventDetails
    ) => void;
    /** The step being played, a live value followed without re-rendering; its cells get `data-current`. */
    source?: Source<number>;
    /** The pattern: a row per sound, each a list of steps. */
    value?: Pattern;
    /** How loud each step plays, 0…1, a row per sound like the pattern; a step it does not list plays at full. */
    velocities?: Velocities;
  }
}
