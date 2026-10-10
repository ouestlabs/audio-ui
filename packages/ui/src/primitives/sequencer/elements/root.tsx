import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import type { Source } from "../../../source";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import {
  SequencerContext,
  type SequencerContextValue,
  type SequencerState,
  type ValueChangeEventDetails,
  type ValueCommitEventDetails,
} from "../context";
import {
  type CellAddress,
  cellAtPoint,
  cellKey,
  isOn,
  moveFocus,
  setCell,
} from "../internal/grid";

const EMPTY: boolean[][] = [];

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
    disabled = false,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    source,
    style,
    value: valueProp,
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
  const context = React.useMemo<SequencerContextValue>(
    () => ({
      actions: {
        focusCell,
        moveFocusFrom,
        pressCell,
        registerCell,
        setTabStop: setTabStopState,
        toggleCell,
      },
      meta: { rows, steps, tabStop: stop, value },
      state,
    }),
    [
      focusCell,
      moveFocusFrom,
      pressCell,
      registerCell,
      rows,
      state,
      steps,
      stop,
      toggleCell,
      value,
    ]
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

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting pattern: a row per sound, each a list of steps. */
    defaultValue?: Pattern;
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
    /** The step being played, a live value followed without re-rendering; its cells get `data-current`. */
    source?: Source<number>;
    /** The pattern: a row per sound, each a list of steps. */
    value?: Pattern;
  }
}
