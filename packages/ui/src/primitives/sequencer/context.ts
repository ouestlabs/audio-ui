import * as React from "react";
import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "../internal/event-details";
import type { Store } from "../internal/store";
import type { CellAddress, Pattern, Velocities } from "./internal/grid";

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

export type VelocityChangeEventDetails =
  | ExtraChangeEventDetails<"drag", PointerEvent>
  | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
  | ExtraChangeEventDetails<"input-change", Event>
  | ExtraChangeEventDetails<"reset", Event>;

export type VelocityCommitEventDetails =
  | ExtraCommitEventDetails<"drag", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
  | ExtraCommitEventDetails<"input-change", Event>
  | ExtraCommitEventDetails<"reset", Event>;

export interface SequencerContextValue {
  actions: {
    /** Sets one step's velocity and commits it at once: for a key, the input or a reset. */
    nudgeVelocity: (
      cell: CellAddress,
      velocity: number,
      eventDetails: VelocityChangeEventDetails
    ) => void;
    pressVelocity: (cell: CellAddress, event: PointerEvent) => void;
    registerVelocity: (cell: CellAddress, node: HTMLElement | null) => void;
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
    /**
     * What changes while the sequencer is used, outside the context: a cell
     * follows only its own piece of it, so pressing one step does not render
     * every other step.
     */
    view: Store<SequencerView>;
  };
  /** What changes rarely: the cells read it, so it stays out of `view`. */
  state: Pick<SequencerState, "disabled">;
}

export interface SequencerView {
  painting: boolean;
  tabStop: CellAddress;
  value: Pattern;
  velocities: Velocities;
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

/** A piece of the sequencer's changing state, re-rendering only when that piece changes. */
export function useSequencerView<T>(
  part: string,
  select: (view: SequencerView) => T
): T {
  const { meta } = useSequencerContext(part);
  return React.useSyncExternalStore(
    meta.view.subscribe,
    () => select(meta.view.get()),
    () => select(meta.view.get())
  );
}

/** The row a part sits in. */
export const RowContext = React.createContext<number | null>(null);
