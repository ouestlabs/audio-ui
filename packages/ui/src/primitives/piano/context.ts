import * as React from "react";
import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "../internal/event-details";
import type { KeyLayout, KeyPlacement } from "./internal/layout";

export type PianoState = {
  disabled: boolean;
  layout: KeyLayout;
  orientation: "horizontal" | "vertical";
};

/** What a key played from the keyboard sounds at. */
export const KEYBOARD_VELOCITY = 0.8;

/** How hard a note is played, 0…1: where along the key a pointer pressed it, lower being harder, or a fixed middling force from the keyboard. */
export type NoteVelocity = { velocity: number };

export type NoteOnEventDetails = NoteVelocity &
  (
    | ExtraChangeEventDetails<"press", PointerEvent>
    | ExtraChangeEventDetails<"glide", PointerEvent>
    | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
  );

export type NoteOffEventDetails =
  | ExtraCommitEventDetails<"press", PointerEvent>
  | ExtraCommitEventDetails<"glide", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", FocusEvent | KeyboardEvent>;

export interface PianoContextValue {
  actions: {
    /** Moves the keyboard's tab stop to `pitch` and focuses its key, showing the focus ring unless a pointer moved it. */
    focusKey: (pitch: number, focusVisible?: boolean) => void;
    /** Proposes a note on; returns whether it sounded. */
    noteOn: (pitch: number, eventDetails: NoteOnEventDetails) => boolean;
    noteOff: (pitch: number, eventDetails: NoteOffEventDetails) => void;
    registerKey: (pitch: number, node: HTMLElement | null) => void;
    /** Moves the tab stop to `pitch`, leaving focus where it is. */
    setTabStop: (pitch: number) => void;
  };
  meta: {
    /** Pitches sounding: pressed here, or listed in `activeNotes`. */
    active: ReadonlySet<number>;
    /** Lowest first. */
    pitches: readonly number[];
    placements: ReadonlyMap<number, KeyPlacement>;
    /** The key the keyboard's single tab stop is on. */
    tabStop: number | undefined;
  };
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
