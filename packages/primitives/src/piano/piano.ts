import { pitchName } from "@audio-ui/core";
import {
  createPianoController,
  type KeyLayout,
  type PianoController,
  type PianoNoteOffEventDetails,
  type PianoNoteOnEventDetails,
  type PianoOptions,
  type PianoSnapshot,
} from "@audio-ui/core/piano";
import {
  css,
  definePrimitive,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { flag, sourceOf } from "../shared.ts";

/**
 * The piano keyboard as a UI SDK primitive, over our controller: a key sounds
 * while it is pressed, by pointer or from the keyboard, dragging across the
 * keys glides from one to the next, each pointer holds its own key, and the
 * keys are one tab stop.
 *
 * A key is keyed by its `pitch`. The app writes one for each pitch the Root
 * lists in its state.
 */

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
  orientation?: "horizontal" | "vertical";
  /** Only these pitches get keys, instead of `minPitch` to `maxPitch`. */
  pitches?: readonly number[];
}

export interface PianoState {
  /** What the controller draws: the pitches, where each sits, the ones sounding. */
  view: PianoSnapshot;
}

/** What a part's className, style and children functions read of the keyboard. */
export interface PianoRootState {
  disabled: boolean;
  layout: KeyLayout;
  orientation: "horizontal" | "vertical";
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
  orientation: "horizontal" | "vertical";
}

/** What a piano's `api` gives an adapter. */
export interface PianoApi {
  controller: PianoController;
  /** Moves the tab stop and the focus to the key of `pitch`. */
  focus: (pitch: number) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (pitch: unknown) => string };
  /** Called by a key as it binds, with its element, and as it unbinds, with none. */
  register: (pitch: number, el: HTMLElement | null) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a key, and of its label: the pitch, which the label inherits. */
interface KeyProps extends PartProps {
  pitch: number;
}

/** The piano's slots, by name, with the props and the public state of each. */
export type PianoSlots = {
  key: SlotDefinition<PianoState, PianoApi, KeyProps, KeyState>;
  label: SlotDefinition<
    PianoState,
    PianoApi,
    PartProps & { pitch?: number },
    { name: string }
  >;
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

/** The controller's options from the primitive's, with the defaults of the published piano. */
const controllerOptions = (options: PianoPrimitiveOptions): PianoOptions => ({
  activeNotes: options.activeNotes,
  disabled: options.disabled ?? false,
  layout: options.layout ?? "keyboard",
  maxPitch: options.maxPitch ?? 72,
  minPitch: options.minPitch ?? 48,
  orientation: options.orientation ?? "horizontal",
  pitches: options.pitches,
});

/** What a keyboard with these options shows before anything presses it. */
function viewOf(options: PianoPrimitiveOptions): PianoSnapshot {
  return createPianoController(controllerOptions(options)).getSnapshot();
}

const rootState = (view: PianoSnapshot): PianoRootState => ({
  disabled: view.disabled,
  layout: view.layout,
  orientation: view.orientation,
  pitches: view.pitches,
});

const keyState = (view: PianoSnapshot, pitch: number): KeyState => ({
  active: view.active.has(pitch),
  color: view.placements.get(pitch)?.black ? "black" : "white",
  disabled: view.disabled,
  name: pitchName(pitch),
  orientation: view.orientation,
});

export const piano: PianoPrimitive = definePrimitive({
  api: (context) => {
    const keys = new Map<number, HTMLElement>();
    const controller: PianoController = createPianoController(
      controllerOptions({})
    );
    const configure = () => {
      const options = context.options() as PianoPrimitiveOptions;
      controller.setOptions({
        ...controllerOptions(options),
        onNoteOff: (pitch, details: PianoNoteOffEventDetails) => {
          dispatch(context, "onNoteOff", pitch, {
            event: details.event,
            reason: details.reason,
          });
        },
        onNoteOn: (pitch, details: PianoNoteOnEventDetails) => {
          const source = sourceOf(details.event);
          // The kernel makes the details the listener sees: its answer is the cancel.
          const canceled = dispatch(context, "onNoteOn", pitch, {
            event: details.event,
            reason: details.reason,
            ...(source ? { source } : {}),
            velocity: details.velocity,
          });
          if (canceled) {
            details.cancel();
          }
        },
      });
      context.store.set({ view: controller.getSnapshot() });
    };
    configure();
    context.onOptions(configure);
    context.onDestroy(
      controller.subscribe(() =>
        context.store.set({ view: controller.getSnapshot() })
      )
    );
    return {
      controller,
      focus: (pitch: number) => {
        controller.focusKey(pitch);
        keys.get(pitch)?.focus({ preventScroll: true });
      },
      internal: { keyOf: (pitch: unknown) => String(pitch) },
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
        const { view } = state;
        const placement = view.placements.get(pitch);
        const current = keyState(view, pitch);
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
        blur: (event, { api, props }) =>
          api.controller.keyOff(Number(props.pitch), event),
        focus: (_event, { api, props }) =>
          api.controller.focusKey(Number(props.pitch)),
        keydown: (event, { api, props, store }) => {
          if (store.get().view.disabled) {
            return;
          }
          const pitch = Number(props.pitch);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            api.controller.keyOn(pitch, event);
            return;
          }
          const next = api.controller.navigate(pitch, event);
          if (next !== null) {
            event.preventDefault();
            api.focus(next);
          }
        },
        keyup: (event, { api, props }) => {
          if (event.key === "Enter" || event.key === " ") {
            api.controller.keyOff(Number(props.pitch), event);
          }
        },
      },
      props: { pitch: "key" },
      state: (state: PianoState, { props }) =>
        keyState(state.view, Number(props.pitch)),
    }),
    label: slot<{ pitch?: number }, { name: string }>({
      attrs: () => ({ "aria-hidden": "true" }),
      props: { pitch: { from: "key", kind: "number", required: true } },
      state: (_state: PianoState, { props }) => ({
        name: pitchName(Number(props.pitch ?? 0)),
      }),
    }),
    root: slot<object, PianoRootState>({
      attrs: (state: PianoState) => ({
        "data-disabled": flag(state.view.disabled),
        "data-layout": state.view.layout,
        "data-orientation": state.view.orientation,
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
          api.controller.press(event, el);
        },
      },
      state: (state: PianoState) => rootState(state.view),
    }),
  }),
  state: (options: PianoPrimitiveOptions): PianoState => ({
    view: viewOf(options),
  }),
  sync: () => ({}),
});
