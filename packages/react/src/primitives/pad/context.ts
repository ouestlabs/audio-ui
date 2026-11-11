import type {
  PadController,
  PadOffEventDetails,
  PadOnEventDetails,
} from "@audio-ui/core/pad";
import * as React from "react";

export type PadState = {
  disabled: boolean;
};

export type OnEventDetails = PadOnEventDetails;

export type OffEventDetails = PadOffEventDetails;

export interface PadContextValue {
  /** The framework-agnostic grid behind its pads: which ones sound, how hard, and the tab stop. */
  controller: PadController;
  /** Focuses the pad `value`, and moves the tab stop to it: the focus ring shows unless a pointer moved it. */
  focusPad: (value: string, focusVisible?: boolean) => void;
  meta: {
    /** Pads sounding: held here, or listed in `activePads`. */
    active: ReadonlySet<string>;
    /** The pad the grid's single tab stop is on. */
    tabStop: string | undefined;
    /** How hard each pad was last struck, from 0 to 1. */
    velocities: ReadonlyMap<string, number>;
  };
  /** Records a pad's element, so the grid knows its reading order and can focus it. */
  registerItem: (
    value: string,
    node: HTMLElement | null,
    disabled: boolean
  ) => void;
  state: PadState;
}

export const PadContext = React.createContext<PadContextValue | null>(null);

export function usePadContext(part: string): PadContextValue {
  const context = React.use(PadContext);
  if (!context) {
    throw new Error(`Pad.${part} must be used within Pad.Root`);
  }
  return context;
}
