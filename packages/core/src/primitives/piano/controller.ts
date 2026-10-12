import { followPointer } from "../../dom/gesture";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events";
import { type KeyLayout, type KeyPlacement, keyAt, placeKeys } from "./layout";

/** The softest a pointer press plays: the very top of a key, not silence. */
export const MIN_VELOCITY = 0.25;
/** What a key played from the keyboard sounds at. */
export const KEYBOARD_VELOCITY = 0.8;
/** Middle C: where the tab stop starts when the keyboard has it. */
const MIDDLE_C = 60;
/** One octave: what Shift + an arrow key, Page Up and Page Down move by. */
const OCTAVE = 12;

export type PianoNoteOnEventDetails = { velocity: number } & (
  | ChangeEventDetails<"press" | "glide", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
);
export type PianoNoteOffEventDetails =
  | CommitEventDetails<"press" | "glide", PointerEvent>
  | CommitEventDetails<"keyboard", FocusEvent | KeyboardEvent>;

export interface PianoOptions {
  activeNotes?: readonly number[];
  disabled?: boolean;
  layout: KeyLayout;
  /** Highest MIDI pitch, inclusive. @default 72 */
  maxPitch: number;
  /** Lowest MIDI pitch, inclusive. @default 48 */
  minPitch: number;
  onNoteOff?: (pitch: number, details: PianoNoteOffEventDetails) => void;
  onNoteOn?: (pitch: number, details: PianoNoteOnEventDetails) => void;
  orientation: "horizontal" | "vertical";
  /** Only these pitches, in place of `minPitch`…`maxPitch`. */
  pitches?: readonly number[];
}

export interface PianoSnapshot {
  /** Pitches sounding: pressed here, or listed in `activeNotes`. */
  active: ReadonlySet<number>;
  disabled: boolean;
  layout: KeyLayout;
  orientation: "horizontal" | "vertical";
  /** Lowest first. */
  pitches: readonly number[];
  placements: ReadonlyMap<number, KeyPlacement>;
  /** The key the keyboard's single tab stop is on. */
  tabStop: number | undefined;
}

export interface PianoController {
  /** Moves the tab stop to `pitch`, leaving focus where it is. */
  focusKey: (pitch: number) => void;
  getSnapshot: () => PianoSnapshot;
  keyOff: (pitch: number, event: FocusEvent | KeyboardEvent) => void;
  /** Keys pressed by the keyboard: Enter or Space sounds the key, until it is released or loses focus. */
  keyOn: (pitch: number, event: KeyboardEvent) => void;
  /** Where the arrow, Page and Home/End keys take the focus from `pitch`: the pitch to focus, or null when the key is not the keyboard's. */
  navigate: (pitch: number, event: KeyboardEvent) => number | null;
  /**
   * Starts a press on the keyboard `element`: the key under the pointer
   * sounds, and dragging across the keys glides from one to the next, with
   * each pointer holding its own key.
   */
  press: (event: PointerEvent, element: Element) => void;
  setOptions: (options: PianoOptions) => void;
  subscribe: (listener: () => void) => () => void;
}

/** Arrow, Page and Home/End targets, as indexes into the keys. */
function keyTargets(
  index: number,
  last: number,
  shiftKey: boolean
): Record<string, number> {
  const step = shiftKey ? OCTAVE : 1;
  return {
    ArrowDown: index - step,
    ArrowLeft: index - step,
    ArrowRight: index + step,
    ArrowUp: index + step,
    End: last,
    Home: 0,
    PageDown: index - OCTAVE,
    PageUp: index + OCTAVE,
  };
}

/** The key the keyboard's tab stop is on: where it was moved to, else middle C, else the lowest key. */
function tabStopOf(
  pitches: readonly number[],
  placements: ReadonlyMap<number, KeyPlacement>,
  focused: number | null
): number | undefined {
  if (focused !== null && placements.has(focused)) {
    return focused;
  }
  return pitches.includes(MIDDLE_C) ? MIDDLE_C : pitches[0];
}

function pitchRange(min: number, max: number): number[] {
  const pitches: number[] = [];
  for (let pitch = Math.round(min); pitch <= max; pitch += 1) {
    pitches.push(pitch);
  }
  return pitches;
}

/**
 * A keyboard's behavior with no view attached: which keys sound, by pointer,
 * glide or keyboard, how hard, and where the keyboard's one tab stop is.
 */
export function createPianoController(initial: PianoOptions): PianoController {
  let options = initial;
  // Each pointer holds its own key; a cancelled note on has nothing to release.
  const pointers = new Map<number, { pitch: number; sounding: boolean }>();
  const heldByKeyboard = new Map<number, boolean>();
  let pressed = new Set<number>();
  let focusedPitch: number | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const pitchesNow = (): readonly number[] =>
    options.pitches
      ? [...new Set(options.pitches)].sort((a, b) => a - b)
      : pitchRange(options.minPitch, options.maxPitch);

  let snapshot: PianoSnapshot | null = null;
  let snapshotKey = "";
  const getSnapshot = (): PianoSnapshot => {
    const pitches = pitchesNow();
    const active = new Set([...pressed, ...(options.activeNotes ?? [])]);
    const disabled = options.disabled ?? false;
    // The snapshot is rebuilt only when what it shows changes, so a view re-renders for it alone.
    const key = [
      pitches.join(","),
      [...active].sort((x, y) => x - y).join(","),
      disabled,
      options.layout,
      options.orientation,
      focusedPitch,
    ].join("|");
    if (snapshot && key === snapshotKey) {
      return snapshot;
    }
    snapshotKey = key;
    const placements = new Map(
      placeKeys(pitches, options.layout).map((placement) => [
        placement.pitch,
        placement,
      ])
    );
    snapshot = {
      active,
      disabled,
      layout: options.layout,
      orientation: options.orientation,
      pitches,
      placements,
      tabStop: tabStopOf(pitches, placements, focusedPitch),
    };
    return snapshot;
  };

  const noteOn = (pitch: number, details: PianoNoteOnEventDetails): boolean => {
    if (options.disabled) {
      return false;
    }
    options.onNoteOn?.(pitch, details);
    if (details.isCanceled) {
      return false;
    }
    pressed = new Set(pressed).add(pitch);
    notify();
    return true;
  };

  const noteOff = (pitch: number, details: PianoNoteOffEventDetails) => {
    const next = new Set(pressed);
    next.delete(pitch);
    pressed = next;
    notify();
    options.onNoteOff?.(pitch, details);
  };

  /** The key under a pointer, and how hard it strikes it. */
  const strikeAt = (event: PointerEvent, element: Element) => {
    const rect = element.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) {
      return null;
    }
    const vertical = options.orientation === "vertical";
    const along = vertical
      ? (rect.bottom - event.clientY) / rect.height
      : (event.clientX - rect.left) / rect.width;
    const across = vertical
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    const placements = [...getSnapshot().placements.values()];
    const hit = keyAt(placements, along, across, options.layout);
    if (!hit) {
      return null;
    }
    // Pressed near the free end of the key is harder, as on a real keyboard.
    const velocity = Math.min(
      1,
      Math.max(MIN_VELOCITY, MIN_VELOCITY + (1 - MIN_VELOCITY) * across)
    );
    return { pitch: hit.pitch, velocity };
  };

  const press: PianoController["press"] = (event, element) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    const strike = strikeAt(event, element);
    if (strike === null) {
      return;
    }
    element.setPointerCapture?.(event.pointerId);
    focusedPitch = strike.pitch;
    const sounding = noteOn(
      strike.pitch,
      Object.assign(createChangeEventDetails("press", event), {
        velocity: strike.velocity,
      }) as PianoNoteOnEventDetails
    );
    pointers.set(event.pointerId, { pitch: strike.pitch, sounding });
    followPointer(
      element,
      event.pointerId,
      (move) => {
        const held = pointers.get(move.pointerId);
        const glide = held ? strikeAt(move, element) : null;
        if (!held || glide === null || glide.pitch === held.pitch) {
          return;
        }
        if (held.sounding) {
          noteOff(held.pitch, {
            event: move,
            reason: "glide",
          } as PianoNoteOffEventDetails);
        }
        focusedPitch = glide.pitch;
        const next = noteOn(
          glide.pitch,
          Object.assign(createChangeEventDetails("glide", move), {
            velocity: glide.velocity,
          }) as PianoNoteOnEventDetails
        );
        pointers.set(move.pointerId, { pitch: glide.pitch, sounding: next });
      },
      (end) => {
        const held = pointers.get(end.pointerId);
        pointers.delete(end.pointerId);
        if (held?.sounding) {
          noteOff(held.pitch, {
            event: end,
            reason: "press",
          } as PianoNoteOffEventDetails);
        }
      }
    );
  };

  const keyOn: PianoController["keyOn"] = (pitch, event) => {
    if (event.repeat || heldByKeyboard.get(pitch)) {
      return;
    }
    const sounding = noteOn(
      pitch,
      Object.assign(createChangeEventDetails("keyboard", event), {
        velocity: KEYBOARD_VELOCITY,
      }) as PianoNoteOnEventDetails
    );
    heldByKeyboard.set(pitch, sounding);
  };

  const keyOff: PianoController["keyOff"] = (pitch, event) => {
    if (!heldByKeyboard.get(pitch)) {
      return;
    }
    heldByKeyboard.set(pitch, false);
    noteOff(pitch, { event, reason: "keyboard" } as PianoNoteOffEventDetails);
  };

  const navigate: PianoController["navigate"] = (pitch, event) => {
    const pitches = pitchesNow();
    const index = pitches.indexOf(pitch);
    const last = pitches.length - 1;
    const target = keyTargets(index, last, event.shiftKey)[event.key];
    if (target === undefined) {
      return null;
    }
    const next = pitches[Math.min(last, Math.max(0, target))];
    if (next !== undefined) {
      focusedPitch = next;
      notify();
    }
    return next ?? null;
  };

  return {
    focusKey: (pitch) => {
      focusedPitch = pitch;
      notify();
    },
    getSnapshot,
    keyOff,
    keyOn,
    navigate,
    press,
    setOptions: (next) => {
      options = next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
