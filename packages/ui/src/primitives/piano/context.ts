import type {
  KeyLayout,
  KeyPlacement,
  PianoController,
  PianoNoteOffEventDetails,
  PianoNoteOnEventDetails,
} from "@audio-ui/core/piano";
import * as React from "react";

export type PianoState = {
  disabled: boolean;
  layout: KeyLayout;
  orientation: "horizontal" | "vertical";
};

export type NoteOnEventDetails = PianoNoteOnEventDetails;

export type NoteOffEventDetails = PianoNoteOffEventDetails;

export interface PianoContextValue {
  /** The framework-free keyboard behind its keys: which sound, how hard, and the tab stop. */
  controller: PianoController;
  /** Focuses the key at `pitch`, and moves the tab stop to it: the focus ring shows unless a pointer moved it. */
  focusKey: (pitch: number, focusVisible?: boolean) => void;
  meta: {
    /** Pitches sounding: pressed here, or listed in `activeNotes`. */
    active: ReadonlySet<number>;
    /** Lowest first. */
    pitches: readonly number[];
    placements: ReadonlyMap<number, KeyPlacement>;
    /** The key the keyboard's single tab stop is on. */
    tabStop: number | undefined;
  };
  /** Records a key's element, so the keyboard can focus it. */
  registerKey: (pitch: number, node: HTMLElement | null) => void;
  state: PianoState;
}

export const PianoContext = React.createContext<PianoContextValue | null>(null);

export function usePianoContext(part: string): PianoContextValue {
  const context = React.use(PianoContext);
  if (!context) {
    throw new Error(`Piano.${part} must be used within Piano.Root`);
  }
  return context;
}

/** The key a part sits in. */
export const KeyContext = React.createContext<number | null>(null);
