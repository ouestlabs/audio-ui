import * as React from "react";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import { usePointerDrag } from "../hooks/interactions/use-pointer-drag";
import type { Nullable, Point, Procedure } from "../utils";
import { clamp, panic } from "../utils";
import { getDataAttributes } from "./internal/data-attributes";
import { useParameterCore } from "./internal/use-parameter-core";

const DEFAULT_ROWS = 4;
const DEFAULT_STEPS = 16;
const DEFAULT_VALUE: boolean[][] = Array.from({ length: DEFAULT_ROWS }, () =>
  Array.from({ length: DEFAULT_STEPS }, () => false)
);

/** A pointer sample mapped into grid space. */
interface GridCell {
  column: number;
  row: number;
}

function cellKey(row: number, column: number) {
  return `${row}:${column}`;
}

export namespace Sequencer {
  interface FocusedCell {
    column: number;
    row: number;
  }

  interface ConfigContextValue {
    activeStep?: number;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    disabled: boolean;
    dragHandlers: {
      onDrag: (e: React.PointerEvent, delta: Point) => void;
      onDragCancel: Procedure<React.PointerEvent>;
      onDragEnd: Procedure<React.PointerEvent>;
      onDragStart: Procedure<React.PointerEvent>;
    };
    elementId: string;
    focusCell: (row: number, column: number) => void;
    registerCell: (
      row: number,
      column: number,
      node: Nullable<HTMLElement>
    ) => void;
    setFocusedCell: Procedure<FocusedCell>;
    shouldPreventFocusRef: React.RefObject<boolean>;
    toggleCell: (row: number, column: number) => void;
    trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  }

  /** Split from config: changes every paint frame, so only components that render live state subscribe to it. */
  interface ValueContextValue {
    focusedCell: FocusedCell;
    value: boolean[][];
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("Sequencer components must be used within Sequencer.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("Sequencer components must be used within Sequencer.Root");
    }
    return context;
  }

  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      "onChange" | "onInput" | "type" | "value" | "defaultValue"
    > {
    /** Highlights the given column across every row (0-indexed). Timing lives outside the primitive. */
    activeStep?: number;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: boolean[][];
    disabled?: boolean;
    onValueChange?: Procedure<boolean[][]>;
    onValueCommit?: Procedure<boolean[][]>;
    value?: boolean[][];
  }

  export function Root({
    value: controlledValue,
    defaultValue = DEFAULT_VALUE,
    activeStep,
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
    const sequencerId = React.useId();
    const trackRef = React.useRef<HTMLDivElement>(null);
    const cellElementsRef = React.useRef(new Map<string, HTMLElement>());
    const paintValueRef = React.useRef(false);
    const lastPaintedRef = React.useRef<Nullable<GridCell>>(null);
    const [focusedCell, setFocusedCell] = React.useState<FocusedCell>({
      column: 0,
      row: 0,
    });

    const transformValue = React.useCallback(
      (matrix: boolean[][]) =>
        matrix.map((row) => row.map((cell) => Boolean(cell))),
      []
    );

    const clampStep = React.useCallback(
      (next: boolean[][]) =>
        next.map((row) => row.map((cell) => Boolean(cell))),
      []
    );

    const containsTarget = React.useCallback(
      (target: Node) => Boolean(trackRef.current?.contains(target)),
      []
    );

    const {
      beginDrag,
      commitValue,
      dragTo,
      endDrag,
      pendingValueRef,
      shouldPreventFocusRef,
      updateValue,
      value,
      valueRef,
    } = useParameterCore<boolean[][]>({
      clampStep,
      containsTarget,
      defaultValue,
      disabled,
      fallbackValue: defaultValue,
      onValueChange,
      onValueCommit,
      transform: transformValue,
      value: controlledValue,
    });

    const getCellFromPoint = React.useCallback(
      (client: Point): Nullable<GridCell> => {
        const track = trackRef.current;
        if (!track) {
          return null;
        }

        const rect = track.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return null;
        }

        const rows = valueRef.current.length;
        const columns = valueRef.current[0]?.length ?? 0;
        if (rows === 0 || columns === 0) {
          return null;
        }

        const rowFraction = clamp((client.y - rect.top) / rect.height, 0, 1);
        const columnFraction = clamp((client.x - rect.left) / rect.width, 0, 1);

        return {
          column: Math.min(Math.floor(columnFraction * columns), columns - 1),
          row: Math.min(Math.floor(rowFraction * rows), rows - 1),
        };
      },
      [valueRef]
    );

    const paintCell = React.useCallback((cell: GridCell, base: boolean[][]) => {
      const row = base[cell.row];
      if (!row || row[cell.column] === paintValueRef.current) {
        return base;
      }
      const nextRow = [...row];
      nextRow[cell.column] = paintValueRef.current;
      const next = [...base];
      next[cell.row] = nextRow;
      return next;
    }, []);

    const handleDragStart = React.useCallback(
      (e: React.PointerEvent) => {
        const cell = getCellFromPoint({ x: e.clientX, y: e.clientY });
        if (!cell) {
          beginDrag(valueRef.current);
          return;
        }

        shouldPreventFocusRef.current = true;
        setFocusedCell(cell);
        cellElementsRef.current.get(cellKey(cell.row, cell.column))?.focus();

        paintValueRef.current = !valueRef.current[cell.row]?.[cell.column];
        lastPaintedRef.current = cell;
        const next = paintCell(cell, valueRef.current);
        beginDrag(next);
        updateValue(next);
      },
      [
        beginDrag,
        getCellFromPoint,
        paintCell,
        shouldPreventFocusRef,
        updateValue,
        valueRef,
      ]
    );

    const handleDrag = React.useCallback(
      (e: React.PointerEvent, _delta: Point) => {
        const cell = getCellFromPoint({ x: e.clientX, y: e.clientY });
        if (!cell) {
          return;
        }
        const last = lastPaintedRef.current;
        if (last && last.row === cell.row && last.column === cell.column) {
          return;
        }
        lastPaintedRef.current = cell;
        dragTo(paintCell(cell, pendingValueRef.current));
      },
      [dragTo, getCellFromPoint, paintCell, pendingValueRef]
    );

    const handleDragEnd = React.useCallback(() => {
      lastPaintedRef.current = null;
      endDrag();
    }, [endDrag]);

    const dragHandlers = React.useMemo(
      () => ({
        onDrag: handleDrag,
        onDragCancel: handleDragEnd,
        onDragEnd: handleDragEnd,
        onDragStart: handleDragStart,
      }),
      [handleDrag, handleDragEnd, handleDragStart]
    );

    const toggleCell = React.useCallback(
      (row: number, column: number) => {
        const currentRow = valueRef.current[row];
        if (!currentRow || column < 0 || column >= currentRow.length) {
          return;
        }
        const nextRow = [...currentRow];
        nextRow[column] = !nextRow[column];
        const next = [...valueRef.current];
        next[row] = nextRow;
        commitValue(next);
      },
      [commitValue, valueRef]
    );

    const focusCell = React.useCallback(
      (row: number, column: number) => {
        const rows = valueRef.current.length;
        const columns = valueRef.current[0]?.length ?? 0;
        if (rows === 0 || columns === 0) {
          return;
        }
        const nextCell: FocusedCell = {
          column: clamp(column, 0, columns - 1),
          row: clamp(row, 0, rows - 1),
        };
        setFocusedCell(nextCell);
        cellElementsRef.current
          .get(cellKey(nextCell.row, nextCell.column))
          ?.focus();
      },
      [valueRef]
    );

    const registerCell = React.useCallback(
      (row: number, column: number, node: Nullable<HTMLElement>) => {
        const key = cellKey(row, column);
        if (node) {
          cellElementsRef.current.set(key, node);
        } else {
          cellElementsRef.current.delete(key);
        }
      },
      []
    );

    const elementId = id || sequencerId;

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        activeStep,
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragHandlers,
        elementId,
        focusCell,
        registerCell,
        setFocusedCell,
        shouldPreventFocusRef,
        toggleCell,
        trackRef,
      }),
      [
        activeStep,
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragHandlers,
        elementId,
        focusCell,
        registerCell,
        shouldPreventFocusRef,
        toggleCell,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ focusedCell, value }),
      [focusedCell, value]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("sequencer", {
              disabled,
              part: "sequencer-wrapper",
            })}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Sequencer
              </span>
            )}
            <span className="sr-only" id={`${elementId}-instructions`}>
              Use arrow keys to move between steps, space or enter to toggle.
            </span>
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface TrackProps extends React.ComponentProps<"div"> {}

  export function Track({ className, style, ...props }: TrackProps) {
    const {
      ariaLabel,
      ariaLabelledBy,
      disabled,
      dragHandlers,
      elementId,
      trackRef,
    } = useConfigContext();

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: trackRef,
      releaseOnOutsideClick: true,
      ...dragHandlers,
    });

    return (
      <div
        aria-label={ariaLabel || "Sequencer"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        className={className}
        {...getDataAttributes("sequencer", { disabled, part: "grid" })}
        ref={trackRef}
        role="grid"
        style={{ touchAction: "none", ...style }}
        {...pointerProps}
        {...props}
      />
    );
  }

  export interface CellsProps {
    children: (state: boolean, row: number, column: number) => React.ReactNode;
  }

  export function Cells({ children }: CellsProps) {
    const { value } = useValueContext();
    return (
      <>
        {value.map((row, rowIndex) =>
          row.map((state, columnIndex) =>
            children(state, rowIndex, columnIndex)
          )
        )}
      </>
    );
  }

  export interface CellProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    children?: React.ReactNode;
    column: number;
    row: number;
  }

  export function Cell({
    row,
    column,
    className,
    children,
    "aria-describedby": ariaDescribedBy,
    ...props
  }: CellProps) {
    const {
      activeStep,
      disabled,
      elementId,
      focusCell,
      registerCell,
      setFocusedCell,
      shouldPreventFocusRef,
      toggleCell,
    } = useConfigContext();
    const { focusedCell, value } = useValueContext();

    const rows = value.length;
    const columns = value[0]?.length ?? 0;
    const state = value[row]?.[column] ?? false;
    const isFocusTarget =
      row === Math.min(focusedCell.row, rows - 1) &&
      column === Math.min(focusedCell.column, columns - 1);
    const isActiveStep = activeStep === column;

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowDown: () => {
          focusCell(row + 1, column);
          return true;
        },
        onArrowLeft: () => {
          focusCell(row, column - 1);
          return true;
        },
        onArrowRight: () => {
          focusCell(row, column + 1);
          return true;
        },
        onArrowUp: () => {
          focusCell(row - 1, column);
          return true;
        },
        onEnd: () => {
          focusCell(row, columns - 1);
          return true;
        },
        onEnter: () => {
          toggleCell(row, column);
          return true;
        },
        onHome: () => {
          focusCell(row, 0);
          return true;
        },
      },
      onKeyDown: (e) => {
        if (!disabled && e.key === " ") {
          e.preventDefault();
          toggleCell(row, column);
        }
      },
    });

    const handleFocus = React.useCallback(() => {
      if (shouldPreventFocusRef.current) {
        shouldPreventFocusRef.current = false;
      }
      setFocusedCell({ column, row });
    }, [column, row, setFocusedCell, shouldPreventFocusRef]);

    const cellRef = React.useCallback(
      (node: Nullable<HTMLElement>) => registerCell(row, column, node),
      [column, registerCell, row]
    );

    return (
      <div
        aria-describedby={ariaDescribedBy || `${elementId}-instructions`}
        aria-disabled={disabled}
        aria-label={`Row ${row + 1}, step ${column + 1}`}
        aria-selected={state}
        className={className}
        {...getDataAttributes("sequencer", {
          "active-step": isActiveStep,
          column: String(column),
          disabled,
          part: "cell",
          row: String(row),
          state: state ? "on" : "off",
        })}
        onFocus={handleFocus}
        ref={cellRef}
        role="gridcell"
        {...keyboardProps}
        tabIndex={disabled || !isFocusTarget ? -1 : 0}
        {...props}
      >
        {children}
      </div>
    );
  }
}
