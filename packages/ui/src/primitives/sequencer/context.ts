import type {
  CellAddress,
  SequencerController,
  SequencerSnapshot,
  SequencerValueChangeEventDetails,
  SequencerValueCommitEventDetails,
  SequencerVelocityChangeEventDetails,
  SequencerVelocityCommitEventDetails,
} from "@audio-ui/core/sequencer";
import * as React from "react";

export type SequencerState = {
  disabled: boolean;
  /** Whether a pointer is painting cells. */
  painting: boolean;
};

export type ValueChangeEventDetails = SequencerValueChangeEventDetails;
export type ValueCommitEventDetails = SequencerValueCommitEventDetails;
export type VelocityChangeEventDetails = SequencerVelocityChangeEventDetails;
export type VelocityCommitEventDetails = SequencerVelocityCommitEventDetails;

/** What a view draws the sequencer from. */
export type SequencerView = SequencerSnapshot;

export interface SequencerContextValue {
  /** The cells' elements by `row:step`, which a paint reads to find the cell under the pointer. */
  cellNodes: Map<string, HTMLElement>;
  /** The framework-agnostic sequencer behind every part: painting, keys, velocities. */
  controller: SequencerController;
  /** Moves focus to a cell's element, once it is the tab stop. */
  focusCell: (cell: CellAddress) => void;
  meta: {
    rows: number;
    steps: number;
  };
  registerCell: (cell: CellAddress, node: HTMLElement | null) => void;
  registerVelocity: (cell: CellAddress, node: HTMLElement | null) => void;
  /** The root element, which a press's gesture follows. */
  rootRef: React.RefObject<HTMLElement | null>;
  /** What changes rarely: the cells read it, so it stays out of the view. */
  state: Pick<SequencerState, "disabled">;
  /** The velocity bars' elements by `row:step`. */
  velocityNodes: Map<string, HTMLElement>;
}

export const SequencerContext =
  React.createContext<SequencerContextValue | null>(null);

export function useSequencerContext(part: string): SequencerContextValue {
  const context = React.use(SequencerContext);
  if (!context) {
    throw new Error(`Sequencer.${part} must be used within Sequencer.Root`);
  }
  return context;
}

/**
 * A piece of the sequencer's changing state, re-rendering only when that piece
 * changes: `select` runs on every change, and `equal` says whether the piece
 * it returned is the same as before.
 */
export function useSequencerView<T>(
  part: string,
  select: (view: SequencerView) => T,
  equal: (a: T, b: T) => boolean = Object.is
): T {
  const { controller } = useSequencerContext(part);
  const last = React.useRef<{ value: T } | null>(null);
  const getSnapshot = React.useCallback(() => {
    const next = select(controller.getSnapshot());
    if (last.current && equal(last.current.value, next)) {
      return last.current.value;
    }
    last.current = { value: next };
    return next;
  }, [controller, equal, select]);
  return React.useSyncExternalStore(
    controller.subscribe,
    getSnapshot,
    getSnapshot
  );
}

/** The row a part sits in. */
export const RowContext = React.createContext<number | null>(null);
