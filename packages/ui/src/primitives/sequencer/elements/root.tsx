import type { Source } from "@audio-ui/core";
import {
  createChangeEventDetails,
  createStore,
  isReleased,
} from "@audio-ui/core";
import {
  type CellAddress,
  cellAtPoint,
  cellKey,
  isOn,
  moveFocus,
  setCell,
  setVelocity,
  type Velocities,
  velocityAtY,
} from "@audio-ui/core/sequencer";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import {
  SequencerContext,
  type SequencerContextValue,
  type SequencerState,
  type SequencerView,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
  type VelocityChangeEventDetails,
  type VelocityCommitEventDetails,
} from "../context";

const EMPTY: boolean[][] = [];
const NO_VELOCITIES: number[][] = [];

interface Paint {
  changed: boolean;
  /** What every cell the pointer crosses is set to: the opposite of the cell it began on. */
  on: boolean;
  pointerId: number;
}

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
    value: valueProp,
    velocities: velocitiesProp,
    ...elementProps
  } = componentProps;

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    readonly (readonly boolean[])[]
  >(() => defaultValue ?? EMPTY);
  const value = isControlled ? valueProp : uncontrolledValue;
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const rows = value.length;
  const steps = value[0]?.length ?? 0;

  const isVelocityControlled = velocitiesProp !== undefined;
  const [uncontrolledVelocities, setUncontrolledVelocities] =
    React.useState<Velocities>(() => defaultVelocities ?? NO_VELOCITIES);
  const velocities = isVelocityControlled
    ? velocitiesProp
    : uncontrolledVelocities;
  const velocitiesRef = React.useRef(velocities);
  velocitiesRef.current = velocities;

  const [painting, setPainting] = React.useState(false);
  const paintRef = React.useRef<Paint | null>(null);
  const [tabStop, setTabStopState] = React.useState<CellAddress>({
    row: 0,
    step: 0,
  });
  const stopRow = Math.min(tabStop.row, Math.max(0, rows - 1));
  const stopStep = Math.min(tabStop.step, Math.max(0, steps - 1));
  const stop = React.useMemo(
    () => ({ row: stopRow, step: stopStep }),
    [stopRow, stopStep]
  );

  const nodesRef = React.useRef(new Map<string, HTMLElement>());
  const registerCell = React.useCallback(
    (cell: CellAddress, node: HTMLElement | null) => {
      if (node) {
        nodesRef.current.set(cellKey(cell), node);
      } else {
        nodesRef.current.delete(cellKey(cell));
      }
    },
    []
  );

  const velocityNodesRef = React.useRef(new Map<string, HTMLElement>());
  const registerVelocity = React.useCallback(
    (cell: CellAddress, node: HTMLElement | null) => {
      if (node) {
        velocityNodesRef.current.set(cellKey(cell), node);
      } else {
        velocityNodesRef.current.delete(cellKey(cell));
      }
    },
    []
  );

  /** Proposes a velocity for one step; returns whether it was applied. */
  const changeVelocity = React.useCallback(
    (
      cell: CellAddress,
      velocity: number,
      eventDetails: VelocityChangeEventDetails
    ) => {
      const next = setVelocity(
        velocitiesRef.current,
        cell,
        Math.min(1, Math.max(0, velocity)),
        valueRef.current.length,
        valueRef.current[0]?.length ?? 0
      );
      if (
        next[cell.row]?.[cell.step] ===
        (velocitiesRef.current[cell.row]?.[cell.step] ?? 1)
      ) {
        return false;
      }
      onVelocityChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      velocitiesRef.current = next;
      if (!isVelocityControlled) {
        setUncontrolledVelocities(next);
      }
      return true;
    },
    [isVelocityControlled, onVelocityChange]
  );

  const nudgeVelocity = React.useCallback(
    (
      cell: CellAddress,
      velocity: number,
      eventDetails: VelocityChangeEventDetails
    ) => {
      if (changeVelocity(cell, velocity, eventDetails)) {
        onVelocityCommitted?.(
          velocitiesRef.current as number[][],
          {
            event: eventDetails.event,
            reason: eventDetails.reason,
          } as VelocityCommitEventDetails
        );
      }
    },
    [changeVelocity, onVelocityCommitted]
  );

  const velocityRef = React.useRef<{
    changed: boolean;
    cell: CellAddress;
    pointerId: number;
  } | null>(null);

  /** Sets the velocity of the step under the pointer in the row being drawn. */
  const drawVelocity = React.useCallback(
    (event: PointerEvent, row: number) => {
      for (const [key, node] of velocityNodesRef.current) {
        const [nodeRow, nodeStep] = key.split(":").map(Number);
        if (nodeRow !== row) {
          continue;
        }
        const box = node.getBoundingClientRect();
        if (event.clientX >= box.left && event.clientX < box.right) {
          const cell = { row, step: nodeStep as number };
          if (
            changeVelocity(
              cell,
              velocityAtY(box, event.clientY),
              createChangeEventDetails("drag", event)
            ) &&
            velocityRef.current
          ) {
            velocityRef.current.changed = true;
          }
          return;
        }
      }
    },
    [changeVelocity]
  );

  const pressVelocity = React.useCallback(
    (cell: CellAddress, event: PointerEvent) => {
      velocityRef.current = {
        cell,
        changed: false,
        pointerId: event.pointerId,
      };
      drawVelocity(event, cell.row);
    },
    [drawVelocity]
  );

  /** Proposes a pattern; returns whether it was applied. */
  const change = React.useCallback(
    (next: boolean[][], eventDetails: ValueChangeEventDetails) => {
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      valueRef.current = next;
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      return true;
    },
    [isControlled, onValueChange]
  );

  const setCellTo = React.useCallback(
    (cell: CellAddress, on: boolean, eventDetails: ValueChangeEventDetails) => {
      if (isOn(valueRef.current, cell) === on) {
        return false;
      }
      return change(setCell(valueRef.current, cell, on), eventDetails);
    },
    [change]
  );

  const focusCell = React.useCallback((cell: CellAddress) => {
    setTabStopState(cell);
    nodesRef.current.get(cellKey(cell))?.focus({ preventScroll: true });
  }, []);

  const toggleCell = React.useCallback(
    (cell: CellAddress, event: KeyboardEvent) => {
      if (
        setCellTo(
          cell,
          !isOn(valueRef.current, cell),
          createChangeEventDetails("keyboard", event)
        )
      ) {
        onValueCommitted?.(valueRef.current as boolean[][], {
          event,
          reason: "keyboard",
        });
      }
    },
    [onValueCommitted, setCellTo]
  );

  const moveFocusFrom = React.useCallback(
    (from: CellAddress, event: KeyboardEvent) => {
      const next = moveFocus(
        from,
        event.key,
        valueRef.current.length,
        valueRef.current[0]?.length ?? 0,
        event.ctrlKey || event.metaKey
      );
      if (!next) {
        return false;
      }
      focusCell(next);
      return true;
    },
    [focusCell]
  );

  const pressCell = React.useCallback(
    (cell: CellAddress, event: PointerEvent) => {
      const on = !isOn(valueRef.current, cell);
      paintRef.current = { changed: false, on, pointerId: event.pointerId };
      setPainting(true);
      if (setCellTo(cell, on, createChangeEventDetails("press", event))) {
        paintRef.current.changed = true;
      }
    },
    [setCellTo]
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drawing = velocityRef.current;
    if (drawing && drawing.pointerId === event.pointerId) {
      if (isReleased(event)) {
        handlePointerEnd(event);
        return;
      }
      drawVelocity(event.nativeEvent, drawing.cell.row);
      return;
    }
    const paint = paintRef.current;
    if (!paint || paint.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    const boxes = [...nodesRef.current].map(
      ([key, node]) => [key, node.getBoundingClientRect()] as const
    );
    const cell = cellAtPoint(boxes, event.clientX, event.clientY);
    if (
      cell &&
      setCellTo(
        cell,
        paint.on,
        createChangeEventDetails("paint", event.nativeEvent)
      )
    ) {
      paint.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drawing = velocityRef.current;
    if (drawing && drawing.pointerId === event.pointerId) {
      velocityRef.current = null;
      if (drawing.changed) {
        onVelocityCommitted?.(velocitiesRef.current as number[][], {
          event: event.nativeEvent,
          reason: "drag",
        });
      }
      return;
    }
    const paint = paintRef.current;
    if (!paint || paint.pointerId !== event.pointerId) {
      return;
    }
    paintRef.current = null;
    setPainting(false);
    if (paint.changed) {
      onValueCommitted?.(valueRef.current as boolean[][], {
        event: event.nativeEvent,
        reason: "paint",
      });
    }
  };

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
      for (const [key, node] of nodesRef.current) {
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
  }, [source, steps]);

  const state = React.useMemo<Root.State>(
    () => ({ disabled, painting }),
    [disabled, painting]
  );
  // What each cell follows lives in a store, so a press renders the cell it
  // changes and not the whole grid.
  const [view] = React.useState(() =>
    createStore<SequencerView>({
      painting,
      tabStop: stop,
      value,
      velocities,
    })
  );
  React.useLayoutEffect(() => {
    view.set({ painting, tabStop: stop, value, velocities });
  }, [painting, stop, value, velocities, view]);
  // The cells carry `data-painting` too, written straight to them: reading it
  // in each cell would render the whole grid at every press and release.
  React.useLayoutEffect(() => {
    for (const node of nodesRef.current.values()) {
      node.toggleAttribute("data-painting", painting);
    }
  }, [painting]);

  // The actions never change identity, so the cells reading them are not
  // rendered when a new `onValueChange` is passed on every render.
  const latest = React.useRef({
    focusCell,
    moveFocusFrom,
    nudgeVelocity,
    pressCell,
    pressVelocity,
    toggleCell,
  });
  latest.current = {
    focusCell,
    moveFocusFrom,
    nudgeVelocity,
    pressCell,
    pressVelocity,
    toggleCell,
  };
  const actions = React.useMemo<SequencerContextValue["actions"]>(
    () => ({
      focusCell: (cell) => latest.current.focusCell(cell),
      moveFocusFrom: (from, event) => latest.current.moveFocusFrom(from, event),
      nudgeVelocity: (cell, velocity, details) =>
        latest.current.nudgeVelocity(cell, velocity, details),
      pressCell: (cell, event) => latest.current.pressCell(cell, event),
      pressVelocity: (cell, event) => latest.current.pressVelocity(cell, event),
      registerCell,
      registerVelocity,
      setTabStop: setTabStopState,
      toggleCell: (cell, event) => latest.current.toggleCell(cell, event),
    }),
    [registerCell, registerVelocity]
  );
  const shared = React.useMemo(() => ({ disabled }), [disabled]);
  const context = React.useMemo<SequencerContextValue>(
    () => ({ actions, meta: { rows, steps, view }, state: shared }),
    [actions, rows, shared, steps, view]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        role: "group",
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
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
