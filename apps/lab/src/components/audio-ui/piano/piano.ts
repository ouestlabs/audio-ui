import {
  bindDrag,
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { clamp } from "@ui-sdk/core/number";
import { isBlackKey, pitchName } from "../pitch";
import { definePrimitive, flag, sourceOf } from "../primitive";

/**
 * The piano keyboard: a key sounds while it is pressed, by pointer or from
 * the keyboard, dragging across the keys glides from one to the next, each
 * pointer holds its own key, and the keys are one tab stop.
 *
 * A key is keyed by its `pitch`. The app writes one for each pitch the Root
 * lists in its state.
 */

/** The softest a pointer press plays: the very top of a key, not silence. */
const MIN_VELOCITY = 0.25;
/** What a key played from the keyboard sounds at. */
const KEYBOARD_VELOCITY = 0.8;
/** Middle C: where the tab stop starts when the keyboard has it. */
const MIDDLE_C = 60;
/** One octave: what Shift with an arrow key, Page Up and Page Down move by. */
const OCTAVE = 12;
/** How far across the keyboard a black key reaches; past it, a press lands on a white key. */
const BLACK_KEY_DEPTH = 0.6;
/** A black key's width, as a share of a white key's. */
const BLACK_KEY_WIDTH = 0.65;

export { pitchName } from "../pitch";

/**
 * How the keys share the keyboard's length: `"keyboard"` like a piano, white
 * keys side by side with the black ones between them, or `"even"`, one equal
 * share each, the way a piano roll's rows are.
 */
export type KeyLayout = "even" | "keyboard";

/** Which way the keyboard runs. */
export type PianoOrientation = "horizontal" | "vertical";

/** Where a key sits along the keyboard, how much of it it takes, and whether it is black. */
export interface KeyPlacement {
  black: boolean;
  pitch: number;
  /** How much of the keyboard's length the key takes, 0 to 1. */
  size: number;
  /** Where the key starts, from the keyboard's low end, 0 to 1. */
  start: number;
}

/** Where each of `pitches` (lowest first) sits along the keyboard. */
function placeKeys(pitches: readonly number[], layout: KeyLayout) {
  if (layout === "even") {
    const size = 1 / Math.max(pitches.length, 1);
    return pitches.map(
      (pitch, index): KeyPlacement => ({
        black: isBlackKey(pitch),
        pitch,
        size,
        start: index * size,
      })
    );
  }
  const white = 1 / Math.max(pitches.filter((p) => !isBlackKey(p)).length, 1);
  const black = white * BLACK_KEY_WIDTH;
  let whites = 0;
  return pitches.map((pitch): KeyPlacement => {
    if (isBlackKey(pitch)) {
      return {
        black: true,
        pitch,
        size: black,
        start: whites * white - black / 2,
      };
    }
    whites += 1;
    return { black: false, pitch, size: white, start: (whites - 1) * white };
  });
}

/**
 * The key under a point, given as shares of the keyboard: `along` its length
 * from the low end, `across` its depth from the back, where black keys are.
 * Black keys sit on top of the white ones, so they are tried first.
 */
function keyAt(
  placements: readonly KeyPlacement[],
  along: number,
  across: number,
  layout: KeyLayout
) {
  const covers = (key: KeyPlacement) =>
    along >= key.start && along < key.start + key.size;
  if (layout === "even") {
    return placements.find(covers) ?? null;
  }
  if (across < BLACK_KEY_DEPTH) {
    const black = placements.find((key) => key.black && covers(key));
    if (black) {
      return black;
    }
  }
  return placements.find((key) => !key.black && covers(key)) ?? null;
}

/** What a note on reports to `onNoteOn`. */
export interface NoteOnDetails {
  cancel: () => void;
  event?: Event;
  /** `"press"`, `"glide"` or `"keyboard"`. */
  reason: string;
  source?: string;
  /** How hard the key was struck, from 0 to 1. */
  velocity: number;
}

/** What a release reports to `onNoteOff`. */
export interface NoteOffDetails {
  event?: Event;
  reason: string;
}

export interface PianoPrimitiveOptions {
  /** Pitches lit from elsewhere, on top of the keys pressed here. */
  activeNotes?: readonly number[];
  disabled?: boolean;
  /** How the keys share the length: like a piano, or one equal share each. @default "keyboard" */
  layout?: KeyLayout;
  /** Highest MIDI pitch, inclusive. @default 72 */
  maxPitch?: number;
  /** Lowest MIDI pitch, inclusive: 60 is middle C. @default 48 */
  minPitch?: number;
  onNoteOff?: (pitch: number, details: NoteOffDetails) => void;
  onNoteOn?: (pitch: number, details: NoteOnDetails) => void;
  /** @default "horizontal" */
  orientation?: PianoOrientation;
  /** Only these pitches get keys, instead of `minPitch` to `maxPitch`. */
  pitches?: readonly number[];
}

export interface PianoState {
  activeNotes: readonly number[];
  disabled: boolean;
  /** The key focus was last put on, by a key or a press. */
  focused: number | null;
  layout: KeyLayout;
  maxPitch: number;
  minPitch: number;
  orientation: PianoOrientation;
  /** The pitches given, if any, in place of the range. */
  pitchList: readonly number[] | undefined;
  /** The pitches pressed here: by a pointer or the keyboard. */
  pressed: ReadonlySet<number>;
}

/** What a view draws the keyboard from. */
export interface PianoSnapshot {
  /** Pitches sounding: pressed here, or listed in `activeNotes`. */
  active: ReadonlySet<number>;
  disabled: boolean;
  layout: KeyLayout;
  orientation: PianoOrientation;
  /** Lowest first. */
  pitches: readonly number[];
  placements: ReadonlyMap<number, KeyPlacement>;
  /** The key the keyboard's single tab stop is on. */
  tabStop: number | undefined;
}

function pitchesOf(state: PianoState): number[] {
  if (state.pitchList) {
    return [...new Set(state.pitchList)].sort((a, b) => a - b);
  }
  const pitches: number[] = [];
  for (
    let pitch = Math.round(state.minPitch);
    pitch <= state.maxPitch;
    pitch += 1
  ) {
    pitches.push(pitch);
  }
  return pitches;
}

const views = new WeakMap<PianoState, PianoSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: PianoState): PianoSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const pitches = pitchesOf(state);
  const placements = new Map(
    placeKeys(pitches, state.layout).map((placement) => [
      placement.pitch,
      placement,
    ])
  );
  let tabStop: number | undefined;
  if (state.focused !== null && placements.has(state.focused)) {
    tabStop = state.focused;
  } else {
    tabStop = pitches.includes(MIDDLE_C) ? MIDDLE_C : pitches[0];
  }
  const view: PianoSnapshot = {
    active: new Set([...state.pressed, ...state.activeNotes]),
    disabled: state.disabled,
    layout: state.layout,
    orientation: state.orientation,
    pitches,
    placements,
    tabStop,
  };
  views.set(state, view);
  return view;
}

/** What a part's className, style and children functions read of the keyboard. */
export interface PianoRootState {
  disabled: boolean;
  layout: KeyLayout;
  orientation: PianoOrientation;
  /** The pitch of each key, lowest first: write a key for each. */
  pitches: readonly number[];
}

/** What a key reads of itself. */
export interface KeyState {
  /** Whether the key is sounding: pressed here, or listed in `activeNotes`. */
  active: boolean;
  color: "black" | "white";
  disabled: boolean;
  /** The name of the pitch, such as "C4". */
  name: string;
  orientation: PianoOrientation;
}

const rootState = (state: PianoState): PianoRootState => {
  const view = viewOf(state);
  return {
    disabled: view.disabled,
    layout: view.layout,
    orientation: view.orientation,
    pitches: view.pitches,
  };
};

const keyState = (state: PianoState, pitch: number): KeyState => {
  const view = viewOf(state);
  return {
    active: view.active.has(pitch),
    color: view.placements.get(pitch)?.black ? "black" : "white",
    disabled: view.disabled,
    name: pitchName(pitch),
    orientation: view.orientation,
  };
};

/** What a piano's `api` gives an adapter. */
export interface PianoApi {
  /** Moves the tab stop and the focus to the key of `pitch`. */
  focus: (pitch: number) => void;
  /** Moves the tab stop to `pitch`, leaving focus where it is. */
  focusKey: (pitch: number) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (pitch: unknown) => string };
  /** Releases a key played from the keyboard. */
  keyOff: (pitch: number, event: FocusEvent | KeyboardEvent) => void;
  /** Plays a key from the keyboard: it sounds until the key is released or loses focus. */
  keyOn: (pitch: number, event: KeyboardEvent) => void;
  /** Where the arrow, Page and Home/End keys take the focus from `pitch`: the pitch to focus, or null when the key is not the keyboard's. */
  navigate: (pitch: number, event: KeyboardEvent) => number | null;
  /**
   * Starts a press on the keyboard `element`: the key under the pointer
   * sounds, and dragging across the keys glides from one to the next, with
   * each pointer holding its own key.
   */
  press: (event: PointerEvent, element: HTMLElement) => void;
  /** Called by a key as it binds, with its element, and as it unbinds, with none. */
  register: (pitch: number, el: HTMLElement | null) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a key. */
interface KeyProps extends PartProps {
  pitch: number;
}

/** The props of a label: the pitch of its key, which it inherits. */
interface LabelProps extends PartProps {
  pitch?: number;
  /** The same pitch, inherited too: what the kernel tells the labels of two keys apart by. */
  value?: number;
}

/** The piano's slots, by name, with the props and the public state of each. */
export type PianoSlots = {
  key: SlotDefinition<PianoState, PianoApi, KeyProps, KeyState>;
  label: SlotDefinition<PianoState, PianoApi, LabelProps, { name: string }>;
  root: SlotDefinition<PianoState, PianoApi, PartProps, PianoRootState>;
};

/**
 * The type of `piano`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface PianoPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: PianoSlots;
  (
    initialOptions: PianoPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: PianoApi;
    get: () => PianoState;
    types: {
      api: PianoApi;
      options: PianoPrimitiveOptions;
      slots: PianoSlots;
      state: PianoState;
    };
  };
}

/** The state an options object asks for, with the defaults of the keyboard. */
const stateOf = (options: PianoPrimitiveOptions) => ({
  activeNotes: options.activeNotes ?? [],
  disabled: options.disabled ?? false,
  layout: options.layout ?? "keyboard",
  maxPitch: options.maxPitch ?? 72,
  minPitch: options.minPitch ?? 48,
  orientation: options.orientation ?? "horizontal",
  pitchList: options.pitches,
});

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

export const piano: PianoPrimitive = definePrimitive({
  api: (context) => {
    const state = () => context.store.get() as PianoState;
    const set = (next: Partial<PianoState>) => context.store.set(next as never);
    const keys = new Map<number, HTMLElement>();
    /** What each pointer holds; a refused note on has nothing to release. */
    const pointers = new Map<
      number,
      { pitch: number; sounding: boolean; stop: () => void }
    >();
    const heldByKeyboard = new Map<number, boolean>();
    context.onDestroy(() => {
      for (const hold of pointers.values()) {
        hold.stop();
      }
    });

    /** Sounds `pitch`, unless the keyboard is disabled or a listener refuses it; says whether it sounds. */
    const noteOn = (
      pitch: number,
      reason: string,
      event: Event,
      velocity: number
    ) => {
      if (state().disabled) {
        return false;
      }
      const source = sourceOf(event);
      // The kernel makes the details the listener sees: its answer is the cancel.
      const canceled = dispatch(context, "onNoteOn", pitch, {
        event,
        reason,
        ...(source ? { source } : {}),
        velocity,
      });
      if (canceled) {
        return false;
      }
      set({ pressed: new Set(state().pressed).add(pitch) });
      return true;
    };

    const noteOff = (pitch: number, reason: string, event: Event) => {
      const pressed = new Set(state().pressed);
      pressed.delete(pitch);
      set({ pressed });
      dispatch(context, "onNoteOff", pitch, { event, reason });
    };

    /** The key under a pointer, and how hard it strikes it. */
    const strikeAt = (event: PointerEvent, element: Element) => {
      const rect = element.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) {
        return null;
      }
      const now = state();
      const vertical = now.orientation === "vertical";
      const along = vertical
        ? (rect.bottom - event.clientY) / rect.height
        : (event.clientX - rect.left) / rect.width;
      const across = vertical
        ? (event.clientX - rect.left) / rect.width
        : (event.clientY - rect.top) / rect.height;
      const hit = keyAt(
        [...viewOf(now).placements.values()],
        along,
        across,
        now.layout
      );
      if (!hit) {
        return null;
      }
      // Pressed near the free end of the key is harder, as on a real keyboard.
      const velocity = clamp(
        MIN_VELOCITY + (1 - MIN_VELOCITY) * across,
        MIN_VELOCITY,
        1
      );
      return { pitch: hit.pitch, velocity };
    };

    return {
      focus: (pitch: number) => {
        set({ focused: pitch });
        keys.get(pitch)?.focus({ preventScroll: true });
      },
      focusKey: (pitch: number) => set({ focused: pitch }),
      internal: { keyOf: (pitch: unknown) => String(pitch) },
      keyOff: (pitch: number, event: FocusEvent | KeyboardEvent) => {
        if (!heldByKeyboard.get(pitch)) {
          return;
        }
        heldByKeyboard.set(pitch, false);
        noteOff(pitch, "keyboard", event);
      },
      keyOn: (pitch: number, event: KeyboardEvent) => {
        if (event.repeat || heldByKeyboard.get(pitch)) {
          return;
        }
        heldByKeyboard.set(
          pitch,
          noteOn(pitch, "keyboard", event, KEYBOARD_VELOCITY)
        );
      },
      navigate: (pitch: number, event: KeyboardEvent) => {
        const { pitches } = viewOf(state());
        const last = pitches.length - 1;
        const target = keyTargets(pitches.indexOf(pitch), last, event.shiftKey)[
          event.key
        ];
        if (target === undefined) {
          return null;
        }
        const next = pitches[clamp(target, 0, last)];
        if (next === undefined) {
          return null;
        }
        set({ focused: next });
        return next;
      },
      press: (event: PointerEvent, element: HTMLElement) => {
        if (state().disabled || event.button !== 0) {
          return;
        }
        const strike = strikeAt(event, element);
        if (strike === null) {
          return;
        }
        set({ focused: strike.pitch });
        // Each pointer holds its own key, until it is released.
        pointers.get(event.pointerId)?.stop();
        const hold: { pitch: number; sounding: boolean; stop: () => void } = {
          pitch: strike.pitch,
          sounding: noteOn(strike.pitch, "press", event, strike.velocity),
          stop: () => undefined,
        };
        pointers.set(event.pointerId, hold);
        hold.stop = bindDrag(element, event, {
          onEnd: (end) => {
            if (pointers.get(event.pointerId) === hold) {
              pointers.delete(event.pointerId);
            }
            if (hold.sounding) {
              noteOff(hold.pitch, "press", end);
            }
          },
          // Dragging across the keys glides from one to the next.
          onMove: ({ event: move }) => {
            const glide = strikeAt(move, element);
            if (glide === null || glide.pitch === hold.pitch) {
              return;
            }
            if (hold.sounding) {
              noteOff(hold.pitch, "glide", move);
            }
            set({ focused: glide.pitch });
            hold.pitch = glide.pitch;
            hold.sounding = noteOn(glide.pitch, "glide", move, glide.velocity);
          },
        });
      },
      register: (pitch: number, el: HTMLElement | null) => {
        if (el) {
          keys.set(pitch, el);
        } else {
          keys.delete(pitch);
        }
      },
    };
  },
  name: "piano",
  options: {
    activeNotes: "value",
    disabled: "boolean",
    layout: "string",
    maxPitch: "number",
    minPitch: "number",
    onNoteOff: "callback",
    onNoteOn: "callback",
    orientation: "string",
    pitches: "value",
  },
  slots: (slot) => ({
    key: slot<KeyProps, KeyState>({
      attrs: (state: PianoState, { props }) => {
        const pitch = Number(props.pitch);
        const view = viewOf(state);
        const placement = view.placements.get(pitch);
        const current = keyState(state, pitch);
        const start = `${(placement?.start ?? 0) * 100}%`;
        const size = `${(placement?.size ?? 0) * 100}%`;
        return {
          "aria-label": current.name,
          "data-active": flag(current.active),
          "data-color": current.color,
          "data-disabled": flag(current.disabled),
          "data-orientation": current.orientation,
          disabled: flag(current.disabled),
          style: css(
            view.orientation === "vertical"
              ? { bottom: start, height: size, position: "absolute" }
              : { left: start, position: "absolute", width: size }
          ),
          tabindex: pitch === view.tabStop ? "0" : "-1",
          type: "button",
        };
      },
      bind: (el, part) => {
        const pitch = Number(part.props.pitch);
        part.api.register(pitch, el);
        return () => part.api.register(pitch, null);
      },
      on: {
        blur: (event, { api, props }) => api.keyOff(Number(props.pitch), event),
        focus: (_event, { api, props }) => api.focusKey(Number(props.pitch)),
        keydown: (event, { api, props, store }) => {
          if (store.get().disabled) {
            return;
          }
          const pitch = Number(props.pitch);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            api.keyOn(pitch, event);
            return;
          }
          const next = api.navigate(pitch, event);
          if (next !== null) {
            event.preventDefault();
            api.focus(next);
          }
        },
        keyup: (event, { api, props }) => {
          if (event.key === "Enter" || event.key === " ") {
            api.keyOff(Number(props.pitch), event);
          }
        },
      },
      props: { pitch: "key" },
      state: (state: PianoState, { props }) =>
        keyState(state, Number(props.pitch)),
    }),
    label: slot<LabelProps, { name: string }>({
      attrs: () => ({ "aria-hidden": "true" }),
      // The pitch as `value` too, which the kernel keys a part by, so the labels of two keys are two parts.
      props: {
        pitch: { from: "key", kind: "number", required: true },
        value: { from: "key.pitch", kind: "number" },
      },
      state: (_state: PianoState, { props }) => ({
        name: pitchName(Number(props.pitch ?? 0)),
      }),
    }),
    root: slot<object, PianoRootState>({
      attrs: (state: PianoState) => ({
        "data-disabled": flag(state.disabled),
        "data-layout": state.layout,
        "data-orientation": state.orientation,
        role: "group",
        style: css({ position: "relative", "touch-action": "none" }),
      }),
      on: {
        // A press anywhere on the keyboard strikes the key under the pointer, and glides.
        pointerdown: (event, { api, el }) => {
          if (!el || event.button !== 0) {
            return;
          }
          event.preventDefault();
          api.press(event, el);
        },
      },
      state: (state: PianoState) => rootState(state),
    }),
  }),
  state: (options: PianoPrimitiveOptions): PianoState => ({
    ...stateOf(options),
    focused: null,
    pressed: new Set(),
  }),
  sync: stateOf,
});