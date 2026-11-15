import {
  createXYPadController,
  type XYPadController,
  type XYPadOptions,
  type XYPadPoint,
  type XYPadSnapshot,
} from "@audio-ui/core/xypad";
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
 * The XY pad as a UI SDK primitive, over our controller, as the knob is: the
 * press and the drag, the wheel, the keys, the grid and the reset stay in the
 * controller; the primitive routes the elements' events to it and its changes
 * through the kernel. Its value is a point, `{ x, y }`, and each axis has a
 * native range input of its own.
 */

export interface XYPadPrimitiveOptions
  extends Omit<XYPadOptions, "onValueChange" | "onValueCommitted"> {
  /** The form field's name: each axis input is `<name>.x` and `<name>.y`. */
  name?: string;
  onValueChange?: (value: XYPadPoint, details: ChangeDetails) => void;
  onValueCommitted?: (value: XYPadPoint, details: CommitDetails) => void;
}

export interface XYPadState {
  /** Whether a label part names the pad. */
  labelled: boolean;
  name: string | undefined;
  /** The point the app holds, or the pad's own. */
  value: XYPadPoint;
  /** What the controller draws: the dragged point, the places, the text. */
  view: XYPadSnapshot;
}

/** What a pad with these options shows before anything moves it. */
function viewOf(options: XYPadPrimitiveOptions): XYPadSnapshot {
  const controller = createXYPadController();
  controller.setOptions(options as XYPadOptions);
  return controller.getSnapshot();
}

/** Only `disabled` and `dragging` are data attributes; the numbers stay in the state. */
const stateAttrs = (view: XYPadSnapshot) => ({
  "data-disabled": flag(view.disabled),
  "data-dragging": flag(view.dragging),
});

/** What a part's className, style and children functions read. */
export interface XYPadPublicState {
  disabled: boolean;
  dragging: boolean;
  formatted: { x: string; y: string };
  formattedPair: string;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  value: XYPadPoint;
}

const publicState = (view: XYPadSnapshot): XYPadPublicState => ({
  disabled: view.disabled,
  dragging: view.dragging,
  formatted: view.formatted,
  formattedPair: view.formattedPair,
  maxX: view.maxX,
  maxY: view.maxY,
  minX: view.minX,
  minY: view.minY,
  value: view.value,
});

/** What an XY pad's `api` gives an adapter. */
export interface XYPadApi {
  controller: XYPadController;
  /** Moves the pad to `point` from outside, as a property does: no change is reported. */
  set: (point: XYPadPoint) => void;
  /** Sets both axes as typed: on the grid, reported and committed. */
  setValue: (x: number, y: number, event?: Event) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** What an axis input takes: how its value is announced. */
interface AxisInputProps extends PartProps {
  getAriaValueText?: (
    formatted: string,
    value: number,
    axis: "x" | "y"
  ) => string;
}

/** The pad's slots, by name, with the props and the public state of each. */
export type XYPadSlots = {
  control: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
  inputX: SlotDefinition<XYPadState, XYPadApi, AxisInputProps, object>;
  inputY: SlotDefinition<XYPadState, XYPadApi, AxisInputProps, object>;
  label: SlotDefinition<XYPadState, XYPadApi, PartProps, object>;
  root: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
  thumb: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
  value: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
};

/**
 * The type of `xypad`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface XYPadPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: XYPadSlots;
  (
    initialOptions: XYPadPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: XYPadApi;
    get: () => XYPadState;
    types: {
      api: XYPadApi;
      options: XYPadPrimitiveOptions;
      slots: XYPadSlots;
      state: XYPadState;
    };
  };
}

export const xypad: XYPadPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const controller: XYPadController = createXYPadController();
    connectController(context, controller);
    return {
      controller,
      set: (point: XYPadPoint) => context.store.set({ value: point }),
      setValue: (x: number, y: number, event?: Event) => {
        const typed = event ?? new Event("change");
        controller.type("x", x, typed);
        controller.type("y", y, typed);
      },
    };
  },
  controlled: ["value"],
  name: "xypad",
  options: {
    defaultValue: "value",
    disabled: "boolean",
    format: "value",
    locale: "value",
    maxX: "number",
    maxY: "number",
    minX: "number",
    minY: "number",
    name: "string",
    onValueChange: "callback",
    onValueCommitted: "callback",
    stepX: "number",
    stepY: "number",
    value: "value",
  },
  slots: (slot) => {
    const axisInput = (axis: "x" | "y") =>
      slot<{
        getAriaValueText?: (
          formatted: string,
          value: number,
          axis: "x" | "y"
        ) => string;
      }>({
        attrs: (state: XYPadState, { id, props }) => {
          const { view } = state;
          const value = view.value[axis];
          const formatted = view.formatted[axis];
          return {
            "aria-labelledby": state.labelled ? `${id}-label` : undefined,
            "aria-orientation": axis === "x" ? "horizontal" : "vertical",
            "aria-valuetext": props.getAriaValueText
              ? props.getAriaValueText(formatted, value, axis)
              : formatted,
            disabled: flag(view.disabled),
            max: String(axis === "x" ? view.maxX : view.maxY),
            min: String(axis === "x" ? view.minX : view.minY),
            name:
              state.name === undefined ? undefined : `${state.name}.${axis}`,
            step: String(axis === "x" ? view.stepX : view.stepY),
            style: css(VISUALLY_HIDDEN),
            // Only the X input is in the tab order: its keys move both axes.
            tabindex: axis === "x" ? undefined : "-1",
            type: "range",
            value: String(value),
          };
        },
        on: {
          change: (event, { api, el }) =>
            api.controller.type(
              axis,
              Number((el as HTMLInputElement).value),
              event
            ),
          input: (event, { api, el }) =>
            api.controller.type(
              axis,
              Number((el as HTMLInputElement).value),
              event
            ),
          keydown: (event, { api }) => {
            if (api.controller.keyDown(event)) {
              event.preventDefault();
            }
          },
        },
        props: { getAriaValueText: "value" },
      });

    return {
      control: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => ({
          ...stateAttrs(state.view),
          style: css({ position: "relative", "touch-action": "none" }),
        }),
        bind: (el, part) => part.api.controller.attachWheel(el),
        on: {
          dblclick: (event, { api }) => {
            if (!api.controller.getSnapshot().disabled) {
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
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              focusVisible: false,
              preventScroll: true,
            } as FocusOptions);
            api.controller.press(event, el);
          },
        },
        state: (state: XYPadState) => publicState(state.view),
      }),
      inputX: axisInput("x"),
      inputY: axisInput("y"),
      label: slot({
        attrs: (state: XYPadState, { id }) => ({
          ...stateAttrs(state.view),
          id: `${id}-label`,
        }),
        bind: (_el, part) => {
          part.store.set({ labelled: true });
          return () => part.store.set({ labelled: false });
        },
      }),
      root: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => ({
          ...stateAttrs(state.view),
          style: css({
            "--xy-pad-x": `${state.view.percentX * 100}%`,
            "--xy-pad-y": `${100 - state.view.percentY * 100}%`,
          }),
        }),
        state: (state: XYPadState) => publicState(state.view),
      }),
      thumb: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => ({
          ...stateAttrs(state.view),
          style: css({
            left: `${state.view.percentX * 100}%`,
            top: `${100 - state.view.percentY * 100}%`,
            translate: "-50% -50%",
          }),
        }),
        state: (state: XYPadState) => publicState(state.view),
      }),
      value: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => ({
          ...stateAttrs(state.view),
          "aria-live": "off",
        }),
        state: (state: XYPadState) => publicState(state.view),
      }),
    };
  },
  state: (options: XYPadPrimitiveOptions): XYPadState => {
    const view = viewOf(options);
    return { labelled: false, name: options.name, value: view.value, view };
  },
  sync: (options: XYPadPrimitiveOptions) =>
    options.value === undefined
      ? { name: options.name }
      : { name: options.name, value: options.value },
});
