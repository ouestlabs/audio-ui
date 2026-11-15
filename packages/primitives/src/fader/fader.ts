import {
  createFaderController,
  type FaderController,
  type FaderOptions,
  type FaderSnapshot,
} from "@audio-ui/core/fader";
import {
  css,
  definePrimitive,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  type ChangeDetails,
  type CommitDetails,
  connectController,
  flag,
  VISUALLY_HIDDEN,
} from "../shared.ts";

/**
 * The fader as a UI SDK primitive, over our controller, as the knob is: the
 * press on the track, the drag of the thumb, the wheel, the keys, the grid and
 * the reset stay in the controller; the primitive routes the elements' events
 * to it and its changes through the kernel.
 */

export interface FaderPrimitiveOptions
  extends Omit<FaderOptions, "onValueChange" | "onValueCommitted"> {
  /** The form field's name, which the native input carries. */
  name?: string;
  onValueChange?: (value: number, details: ChangeDetails) => void;
  onValueCommitted?: (value: number, details: CommitDetails) => void;
}

export interface FaderState {
  /** Whether a label part names the fader. */
  labelled: boolean;
  name: string | undefined;
  /** The value the app holds, or the fader's own. */
  value: number;
  /** What the controller draws: the dragged value, the places, the text. */
  view: FaderSnapshot;
}

/** What a fader with these options shows before anything moves it. */
function viewOf(options: FaderPrimitiveOptions): FaderSnapshot {
  const controller = createFaderController();
  controller.setOptions(options as FaderOptions);
  return controller.getSnapshot();
}

/** The state attributes every part carries, as the published fader writes them. */
const stateAttrs = (view: FaderSnapshot) => ({
  "data-disabled": flag(view.disabled),
  "data-dragging": flag(view.dragging),
  "data-orientation": view.orientation,
});

/** What a part's className, style and children functions read. */
export interface FaderPublicState {
  disabled: boolean;
  dragging: boolean;
  formatted: string;
  max: number;
  min: number;
  orientation: FaderSnapshot["orientation"];
  value: number;
}

const publicState = (view: FaderSnapshot): FaderPublicState => ({
  disabled: view.disabled,
  dragging: view.dragging,
  formatted: view.formatted,
  max: view.max,
  min: view.min,
  orientation: view.orientation,
  value: view.value,
});

/** What a fader's `api` gives an adapter. */
export interface FaderApi {
  controller: FaderController;
  /** Moves the fader to `value` from outside, as a property does: no change is reported. */
  set: (value: number) => void;
  /** Sets the value as typed: on the grid, reported and committed. */
  setValue: (value: number, event?: Event) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The fader's slots, by name, with the props and the public state of each. */
export type FaderSlots = {
  control: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  indicator: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  input: SlotDefinition<
    FaderState,
    FaderApi,
    PartProps & {
      getAriaValueText?: (
        formatted: string,
        value: number,
        index: number
      ) => string;
    },
    object
  >;
  label: SlotDefinition<FaderState, FaderApi, PartProps, object>;
  mark: SlotDefinition<
    FaderState,
    FaderApi,
    PartProps & { value: number },
    FaderPublicState & { active: boolean }
  >;
  root: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  thumb: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  track: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  value: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
};

/**
 * The type of `fader`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface FaderPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: FaderSlots;
  (
    initialOptions: FaderPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: FaderApi;
    get: () => FaderState;
    types: {
      api: FaderApi;
      options: FaderPrimitiveOptions;
      slots: FaderSlots;
      state: FaderState;
    };
  };
}

const inputOf = (el: HTMLElement | undefined) =>
  el?.querySelector<HTMLInputElement>('input[type="range"]') ?? undefined;

export const fader: FaderPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const controller: FaderController = createFaderController();
    connectController(context, controller);
    return {
      controller,
      set: (value: number) => context.store.set({ value }),
      setValue: (value: number, event?: Event) =>
        controller.type(value, event ?? new Event("change")),
    };
  },
  controlled: ["value"],
  name: "fader",
  options: {
    anchor: "number",
    defaultValue: "number",
    disabled: "boolean",
    format: "value",
    largeStep: "number",
    locale: "value",
    max: "number",
    min: "number",
    name: "string",
    onValueChange: "callback",
    onValueCommitted: "callback",
    orientation: "string",
    step: "number",
    value: "number",
  },
  slots: (slot) => ({
    control: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => ({
        ...stateAttrs(state.view),
        style: css({ position: "relative", "touch-action": "none" }),
      }),
      bind: (el, part) => part.api.controller.attachWheel(el),
      on: {
        // A double click, an Alt + click or Delete return to the default, as in a DAW.
        dblclick: (event, { api, el }) => {
          if (el && !api.controller.getSnapshot().disabled) {
            api.controller.reset(event);
          }
        },
        keydown: (event, { api }) => {
          if (
            !api.controller.getSnapshot().disabled &&
            (event.key === "Delete" || event.key === "Backspace")
          ) {
            event.preventDefault();
            api.controller.reset(event);
          }
        },
        pointerdown: (event, { api, el }) => {
          if (
            !el ||
            api.controller.getSnapshot().disabled ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          if (event.altKey) {
            api.controller.reset(event);
            return;
          }
          inputOf(el)?.focus({ preventScroll: true });
          api.controller.press(
            event,
            el,
            el.querySelector<HTMLElement>('[data-slot="fader-thumb"]')
          );
        },
      },
      state: (state: FaderState) => publicState(state.view),
    }),
    indicator: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => {
        const { fill, orientation } = state.view;
        const size = fill.to - fill.from;
        return {
          ...stateAttrs(state.view),
          style: css(
            orientation === "vertical"
              ? {
                  bottom: `${fill.from}%`,
                  height: `${size}%`,
                  width: "inherit",
                }
              : {
                  height: "inherit",
                  "inset-inline-start": `${fill.from}%`,
                  width: `${size}%`,
                }
          ),
        };
      },
      state: (state: FaderState) => publicState(state.view),
    }),
    // The native range input: the role, the value and the name live on it.
    input: slot<{
      getAriaValueText?: (
        formatted: string,
        value: number,
        index: number
      ) => string;
    }>({
      attrs: (state: FaderState, { id, props }) => ({
        "aria-labelledby": state.labelled ? `${id}-label` : undefined,
        "aria-orientation": state.view.orientation,
        "aria-valuetext": props.getAriaValueText
          ? props.getAriaValueText(state.view.formatted, state.view.value, 0)
          : state.view.formatted,
        disabled: flag(state.view.disabled),
        max: String(state.view.max),
        min: String(state.view.min),
        name: state.name,
        step: String(state.view.step),
        style: css({
          ...VISUALLY_HIDDEN,
          height: "100%",
          width: "100%",
          ...(state.view.orientation === "vertical"
            ? { "writing-mode": "vertical-lr" }
            : {}),
        }),
        type: "range",
        value: String(state.view.value),
      }),
      on: {
        change: (event, { api, el }) =>
          api.controller.type(Number((el as HTMLInputElement).value), event),
        input: (event, { api, el }) =>
          api.controller.type(Number((el as HTMLInputElement).value), event),
        keydown: (event, { api, el }) => {
          if (el && api.controller.keyDown(event, el)) {
            event.preventDefault();
          }
        },
      },
      props: { getAriaValueText: "value" },
    }),
    label: slot({
      attrs: (state: FaderState, { id }) => ({
        ...stateAttrs(state.view),
        id: `${id}-label`,
      }),
      bind: (_el, part) => {
        part.store.set({ labelled: true });
        return () => part.store.set({ labelled: false });
      },
    }),
    mark: slot<{ value: number }, FaderPublicState & { active: boolean }>({
      attrs: (state: FaderState, { props }) => {
        const { anchor, max, min, orientation, value } = state.view;
        const at = Math.min(
          100,
          Math.max(0, ((props.value - min) / (max - min || 1)) * 100)
        );
        const from = anchor ?? min;
        const active =
          props.value >= Math.min(from, value) &&
          props.value <= Math.max(from, value);
        return {
          "aria-hidden": "true",
          "data-active": flag(active),
          "data-disabled": flag(state.view.disabled),
          "data-orientation": orientation,
          style: css({
            position: "absolute",
            ...(orientation === "vertical"
              ? { bottom: `${at}%` }
              : { "inset-inline-start": `${at}%` }),
          }),
        };
      },
      props: { value: "number" },
      state: (state: FaderState, { props }) => {
        const { anchor, min, value } = state.view;
        const from = anchor ?? min;
        return {
          ...publicState(state.view),
          active:
            props.value >= Math.min(from, value) &&
            props.value <= Math.max(from, value),
        };
      },
    }),
    root: slot<object, FaderPublicState>({
      attrs: (state: FaderState, { id }) => ({
        ...stateAttrs(state.view),
        "aria-labelledby": state.labelled ? `${id}-label` : undefined,
        role: "group",
      }),
      state: (state: FaderState) => publicState(state.view),
    }),
    thumb: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => {
        const { dragging, orientation, share } = state.view;
        const vertical = orientation === "vertical";
        return {
          ...stateAttrs(state.view),
          style: css({
            ...(vertical
              ? { bottom: `${share}%`, left: "50%", translate: "-50% 50%" }
              : {
                  "inset-inline-start": `${share}%`,
                  top: "50%",
                  translate: "-50% -50%",
                }),
            position: "absolute",
            ...(dragging ? { "z-index": "1" } : {}),
          }),
        };
      },
      state: (state: FaderState) => publicState(state.view),
    }),
    track: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => ({
        ...stateAttrs(state.view),
        style: css({ position: "relative" }),
      }),
      state: (state: FaderState) => publicState(state.view),
    }),
    value: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => ({
        ...stateAttrs(state.view),
        "aria-live": "off",
      }),
      state: (state: FaderState) => publicState(state.view),
    }),
  }),
  state: (options: FaderPrimitiveOptions): FaderState => {
    const view = viewOf(options);
    return { labelled: false, name: options.name, value: view.value, view };
  },
  sync: (options: FaderPrimitiveOptions) =>
    options.value === undefined
      ? { name: options.name }
      : { name: options.name, value: options.value },
});
