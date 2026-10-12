import * as React from "react";
import type { Nullable } from "../../utils";
import type { Root } from "./elements/root";

export interface FaderContextValue {
  anchor: number | undefined;
  /** Reports a new value: `onValueChange`, then the value unless it was canceled; says whether it was kept. */
  change: (next: number, details: Root.ChangeEventDetails) => boolean;
  /** Reports the end of an interaction that set `value`. */
  commit: (value: number, details: Root.CommitEventDetails) => void;
  disabled: boolean;
  /** The value as text, with Root's `format` and `locale`. */
  formatted: string;
  /** The native input's id, so a `Value` can point at it. */
  inputId: string;
  /** The input, so a press on the control can focus it. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** The id of a `Label`, which names the input when the thumb has no name of its own. */
  labelId: string | undefined;
  largeStep: number;
  max: number;
  min: number;
  name: string | undefined;
  orientation: "horizontal" | "vertical";
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event: KeyboardEvent | MouseEvent | PointerEvent) => void;
  /** Sets a value at once and commits it: keys, a typed value, the wheel. */
  set: (
    next: number,
    reason: Exclude<Root.ChangeEventReason, "drag" | "track-press">,
    event: Event
  ) => void;
  setDragging: (dragging: boolean) => void;
  setLabelId: (id: string | undefined) => void;
  state: Root.State;
  step: number;
  /** The thumb, so a press on it drags from where it was taken. */
  thumbRef: React.RefObject<HTMLElement | null>;
  /** Sets a typed value, reporting an `"input-change"` change and commit. */
  type: (typed: number, event: Event) => void;
  /** The value as displayed. */
  value: number;
  wheelRef: (node: Nullable<HTMLElement>) => void;
}

export const FaderContext = React.createContext<FaderContextValue | null>(null);

export function useFaderContext(part: string): FaderContextValue {
  const context = React.use(FaderContext);
  if (!context) {
    throw new Error(`Fader.${part} must be used within Fader.Root`);
  }
  return context;
}

/** The state is exposed as data attributes, the value aside: it is no presence to style by. */
export const FADER_STATE_ATTRIBUTES = { value: () => null };
