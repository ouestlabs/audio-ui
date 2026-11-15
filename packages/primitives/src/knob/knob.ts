import {
  ARC_OUTER_RADIUS,
  arcPath,
  createKnobController,
  DEFAULT_ARC_STROKE_WIDTH,
  type KnobController,
  type KnobOptions,
  type KnobSnapshot,
  START_ANGLE,
  SWEEP_ANGLE,
} from "@audio-ui/core/knob";
import {
  type ChangeSource,
  createChange,
  css,
  definePrimitive,
  dispatch,
} from "@ui-sdk/core";

/**
 * The knob as a UI SDK primitive, with nothing of the knob rewritten: the
 * gestures, the scale, the stepping and the reset stay in our controller, and
 * the primitive only routes the elements' events to it and its changes
 * through the kernel, so a change reports its source, an agent can set it,
 * and every framework renders it from this one file.
 *
 * What a part draws inside itself (the arcs, the value's text) is in its
 * public state, and each framework draws it its own way: React as children,
 * so the server writes it, custom elements from the knob's root.
 */

export interface ChangeDetails {
  cancel: () => void;
  event?: Event;
  reason: string;
  source?: string;
}

export interface KnobPrimitiveOptions
  extends Omit<KnobOptions, "onValueChange" | "onValueCommitted"> {
  /** The form field's name, which the native input carries. */
  name?: string;
  onValueChange?: (value: number, details: ChangeDetails) => void;
  onValueCommitted?: (
    value: number,
    details: { event?: Event; reason: string }
  ) => void;
}

export interface KnobState {
  /** Whether a label part names the knob. */
  labelled: boolean;
  name: string | undefined;
  /** The value the app holds, or the knob's own. */
  value: number;
  /** What the controller draws: the dragged value, the angle, the text. */
  view: KnobSnapshot;
}

/** What a knob with these options shows before anything moves it. */
function viewOf(options: KnobPrimitiveOptions): KnobSnapshot {
  const controller = createKnobController();
  controller.setOptions(options as KnobOptions);
  return controller.getSnapshot();
}

const flag = (on: boolean) => (on ? "" : undefined);

/**
 * How a change of ours came about, when its event says. UI SDK reads it from
 * its own reasons, which ours aren't, or from input it tracks once asked, so
 * the first interaction would report "programmatic". Without such an event,
 * UI SDK decides, and an agent's change stays the agent's.
 */
function sourceOf(event?: Event): ChangeSource | undefined {
  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) {
    return event.pointerType === "touch" || event.pointerType === "pen"
      ? event.pointerType
      : "mouse";
  }
  if (event instanceof KeyboardEvent) {
    return "keyboard";
  }
  if (event instanceof WheelEvent) {
    return "mouse";
  }
}

/** The state attributes every part carries, as the published knob writes them. */
const stateAttrs = (view: KnobSnapshot) => ({
  "data-disabled": flag(view.disabled),
  "data-drag-mode": view.dragMode,
  "data-dragging": flag(view.dragging),
});

/** What a part's className, style and children functions read. */
export interface KnobPublicState {
  disabled: boolean;
  dragging: boolean;
  dragMode: KnobSnapshot["dragMode"];
  formatted: string;
  max: number;
  min: number;
  value: number;
}

/** What the arcs read: the knob's state and the `d` of their path. */
export interface ArcState extends KnobPublicState {
  arc: string | null;
}

const publicState = (view: KnobSnapshot): KnobPublicState => ({
  disabled: view.disabled,
  dragging: view.dragging,
  dragMode: view.dragMode,
  formatted: view.formatted,
  max: view.max,
  min: view.min,
  value: view.value,
});

/** The `d` of an arc from `from` to `to` along the sweep, or null when there is none to draw. */
export function arcOf(strokeWidth: number, from: number, to: number) {
  return Math.abs(to - from) > 0.001
    ? arcPath(ARC_OUTER_RADIUS - strokeWidth / 2, from, to)
    : null;
}

/** Where the indicator's arc runs: from the anchor to the value, either way. */
export const indicatorSpan = (view: KnobSnapshot) =>
  [
    Math.min(view.anchorPercent, view.percent),
    Math.max(view.anchorPercent, view.percent),
  ] as const;

export const VISUALLY_HIDDEN = {
  border: "0",
  "clip-path": "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "absolute",
  "white-space": "nowrap",
  width: "1px",
};

export const knob = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const change = createChange(context);
    const controller: KnobController = createKnobController();
    let configuredValue: number | undefined;
    const configure = () => {
      const options = context.options() as KnobPrimitiveOptions;
      configuredValue = context.store.get().value;
      controller.setOptions({
        ...options,
        // The controller always works controlled: the kernel holds the value.
        onValueChange: (value, details) => {
          const source = sourceOf(details.event);
          const accepted = change("value", value, {
            event: details.event,
            reason: details.reason,
            ...(source ? { source } : {}),
          });
          if (!accepted) {
            details.cancel();
          }
        },
        onValueCommitted: (value, details) => {
          dispatch(context, "onValueCommitted", value, {
            event: details.event,
            reason: details.reason,
          });
        },
        value: configuredValue,
      } as KnobOptions);
      // The controller tells no one of new options: the parts read its snapshot here.
      context.store.set({ view: controller.getSnapshot() });
    };
    configure();
    context.onOptions(configure);
    context.onDestroy(
      context.store.subscribe(() => {
        if (context.store.get().value !== configuredValue) {
          configure();
        }
      })
    );
    context.onDestroy(
      controller.subscribe(() =>
        context.store.set({ view: controller.getSnapshot() })
      )
    );
    return {
      controller,
      /** Moves the knob to `value` from outside, as a property does: no change is reported. */
      set: (value: number) => context.store.set({ value }),
      /** Sets the value as typed: on the grid, reported and committed. */
      setValue: (value: number, event?: Event) =>
        controller.type(value, event ?? new Event("change")),
    };
  },
  controlled: ["value"],
  name: "knob",
  options: {
    anchor: "number",
    defaultValue: "number",
    disabled: "boolean",
    dragMode: "string",
    format: "value",
    largeStep: "number",
    locale: "value",
    max: "number",
    min: "number",
    name: "string",
    onValueChange: "callback",
    onValueCommitted: "callback",
    scale: "value",
    step: "number",
    value: "number",
  },
  slots: (slot) => ({
    control: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state.view),
        style: css({ position: "relative", "touch-action": "none" }),
      }),
      bind: (el, part) => part.api.controller.attachWheel(el),
      on: {
        pointerdown: (event, { api, el }) => {
          if (el) {
            api.controller.press(event, el);
          }
        },
      },
      state: (state: KnobState) => publicState(state.view),
    }),
    indicator: slot<{ strokeWidth?: number }, ArcState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state.view),
        "aria-hidden": "true",
        viewBox: "0 0 48 48",
      }),
      props: { strokeWidth: "number" },
      state: (state: KnobState, { props }) => ({
        ...publicState(state.view),
        arc: arcOf(
          props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH,
          ...indicatorSpan(state.view)
        ),
      }),
    }),
    // The native range input: the role, the value and the name live on it.
    input: slot<{
      getAriaValueText?: (formatted: string, value: number) => string;
    }>({
      attrs: (state: KnobState, { id, props }) => ({
        "aria-labelledby": state.labelled ? `${id}-label` : undefined,
        "aria-valuetext": props.getAriaValueText
          ? props.getAriaValueText(state.view.formatted, state.view.value)
          : state.view.formatted,
        disabled: flag(state.view.disabled),
        max: String(state.view.max),
        min: String(state.view.min),
        name: state.name,
        step: String(state.view.step),
        style: css(VISUALLY_HIDDEN),
        type: "range",
        value: String(state.view.value),
      }),
      on: {
        change: (event, { api, el }) =>
          api.controller.type(Number((el as HTMLInputElement).value), event),
        input: (event, { api, el }) =>
          api.controller.type(Number((el as HTMLInputElement).value), event),
        keydown: (event, { api }) => {
          if (api.controller.keyDown(event)) {
            event.preventDefault();
          }
        },
      },
      // A formatter, read for its result: "callback" would make it an event in Vue.
      props: { getAriaValueText: "value" },
    }),
    // Names the knob's input, when nothing else does.
    label: slot({
      attrs: (state: KnobState, { id }) => ({
        ...stateAttrs(state.view),
        id: `${id}-label`,
      }),
      bind: (_el, part) => {
        part.store.set({ labelled: true });
        return () => part.store.set({ labelled: false });
      },
    }),
    mark: slot<{ value: number }, KnobPublicState>({
      attrs: (state: KnobState, { props }) => {
        const { view } = state;
        const position = view.scale.toPosition(props.value, view.min, view.max);
        const angle = START_ANGLE + position * SWEEP_ANGLE;
        const [lower, upper] = indicatorSpan(view);
        return {
          ...stateAttrs(view),
          "aria-hidden": "true",
          "data-active": flag(
            position >= lower - 1e-9 && position <= upper + 1e-9
          ),
          style: css({
            "--knob-mark-angle": `${angle}deg`,
            rotate: `${angle}deg`,
          }),
        };
      },
      props: { value: "number" },
      state: (state: KnobState) => publicState(state.view),
    }),
    root: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => stateAttrs(state.view),
      state: (state: KnobState) => publicState(state.view),
    }),
    thumb: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state.view),
        style: css({ rotate: `${state.view.angle}deg` }),
      }),
      state: (state: KnobState) => publicState(state.view),
    }),
    track: slot<{ strokeWidth?: number }, ArcState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state.view),
        "aria-hidden": "true",
        viewBox: "0 0 48 48",
      }),
      props: { strokeWidth: "number" },
      state: (state: KnobState, { props }) => ({
        ...publicState(state.view),
        arc: arcOf(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH, 0, 1),
      }),
    }),
    value: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state.view),
        "aria-live": "off",
      }),
      state: (state: KnobState) => publicState(state.view),
    }),
  }),
  state: (options: KnobPrimitiveOptions): KnobState => {
    const view = viewOf(options);
    return { labelled: false, name: options.name, value: view.value, view };
  },
  sync: (options: KnobPrimitiveOptions) =>
    options.value === undefined
      ? { name: options.name }
      : { name: options.name, value: options.value },
});

// Their names let the declaration of `knob` refer to the kernel's own types.
export type { Primitive, SlotDefinition } from "@ui-sdk/core";
