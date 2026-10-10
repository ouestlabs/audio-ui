import * as React from "react";
import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "../internal/event-details";
import type { CellAddress, Pattern } from "./internal/grid";

export type SequencerState = {
  disabled: boolean;
  /** Whether a pointer is painting cells. */
  painting: boolean;
};

export type ValueChangeEventDetails =
  | ExtraChangeEventDetails<"press", PointerEvent>
  | ExtraChangeEventDetails<"paint", PointerEvent>
  | ExtraChangeEventDetails<"keyboard", KeyboardEvent>;

export type ValueCommitEventDetails =
  | ExtraCommitEventDetails<"press", PointerEvent>
  | ExtraCommitEventDetails<"paint", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", KeyboardEvent>;

export interface SequencerContextValue {
  actions: {
    focusCell: (cell: CellAddress) => void;
    moveFocusFrom: (from: CellAddress, event: KeyboardEvent) => boolean;
    pressCell: (cell: CellAddress, event: PointerEvent) => void;
    registerCell: (cell: CellAddress, node: HTMLElement | null) => void;
    setTabStop: (cell: CellAddress) => void;
    toggleCell: (cell: CellAddress, event: KeyboardEvent) => void;
  };
  meta: {
    steps: number;
    rows: number;
    tabStop: CellAddress;
    value: Pattern;
  };
  state: SequencerState;
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

/** The row a part sits in. */
export const RowContext = React.createContext<number | null>(null);
