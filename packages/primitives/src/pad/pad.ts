import {
  createPadController,
  type PadController,
  type PadOffEventDetails,
  type PadOnEventDetails,
  type PadOptions,
  type PadSnapshot,
} from "@audio-ui/core/pad";
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
 * The pad grid as a UI SDK primitive, over our controller: a pad sounds while
 * it is held, by pointer or from the keyboard, each pointer holds its own pad,
 * pads of a choke group stop each other, and the grid is one tab stop.
 *
 * A pad is keyed by its `value`. The reading order of the pads, which the
 * arrow keys walk, is their order in the document, read from the elements as
 * they bind.
 */

/** What a strike reports to `onPadOn`. */
export interface PadOnDetails {
  cancel: () => void;
  event?: Event;
  reason: string;
  source?: string;
  /** How hard the pad was struck, from 0 to 1. */
  velocity: number;
}

/** What a release reports to `onPadOff`. */
export interface PadOffDetails {
  event?: Event;
  /** `"press"`, `"keyboard"`, or `"choke"` when another pad of its group cut it. */
  reason: string;
}

export interface PadPrimitiveOptions {
  /** Pads lit from elsewhere, on top of the ones held here. */
  activePads?: readonly string[];
  /** How many pads a row holds: what the up and down arrows move by. @default 4 */
  columns?: number;
  disabled?: boolean;
  onPadOff?: (value: string, details: PadOffDetails) => void;
  onPadOn?: (value: string, details: PadOnDetails) => void;
}

export interface PadState {
  /** What the controller draws: the pads sounding, how hard, the tab stop. */
  view: PadSnapshot;
}

/** What a part's className, style and children functions read. */
export interface PadRootState {
  disabled: boolean;
}

/** What a pad reads of itself. */
export interface PadItemState {
  /** Whether the pad is sounding: held here, or listed in `activePads`. */
  active: boolean;
  disabled: boolean;
}

/** What a pad grid's `api` gives an adapter. */
export interface PadApi {
  controller: PadController;
  /** Moves the tab stop and the focus to the pad `value`. */
  focus: (value: string) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (value: unknown) => string };
  /** Reads the pads' order and which are disabled again, from the document. */
  refresh: () => void;
  /** Called by a pad as it binds, with its element, and as it unbinds, with none. */
  register: (
    value: string,
    el: HTMLElement | null,
    props: () => ItemProps
  ) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a pad. */
interface ItemProps extends PartProps {
  /** Pads sharing a choke group stop each other. */
  chokeGroup?: string;
  disabled?: boolean;
  /** What identifies this pad in `onPadOn`, `onPadOff` and `activePads`. */
  value: string;
}

/** The pad grid's slots, by name, with the props and the public state of each. */
export type PadSlots = {
  item: SlotDefinition<PadState, PadApi, ItemProps, PadItemState>;
  root: SlotDefinition<PadState, PadApi, PartProps, PadRootState>;
};

/**
 * The type of `pad`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface PadPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: PadSlots;
  (
    initialOptions: PadPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: PadApi;
    get: () => PadState;
    types: {
      api: PadApi;
      options: PadPrimitiveOptions;
      slots: PadSlots;
      state: PadState;
    };
  };
}

/** What a grid with these options shows before anything strikes it. */
function viewOf(options: PadPrimitiveOptions): PadSnapshot {
  const controller = createPadController({
    activePads: options.activePads,
    columns: options.columns ?? 4,
    disabled: options.disabled,
    values: [],
  });
  return controller.getSnapshot();
}

export const pad: PadPrimitive = definePrimitive({
  api: (context) => {
    /** The pads bound now: their element and their part, whose props are the newest. */
    const items = new Map<
      string,
      { el: HTMLElement; props: () => ItemProps }
    >();
    const controller: PadController = createPadController({
      columns: 4,
      values: [],
    });
    const configure = () => {
      const options = context.options() as PadPrimitiveOptions;
      // The reading order of the pads is their order in the document.
      const ordered = [...items].sort(([, a], [, b]) =>
        a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1
      );
      const controllerOptions: PadOptions = {
        activePads: options.activePads,
        columns: options.columns ?? 4,
        disabled: options.disabled ?? false,
        disabledValues: ordered
          .filter(([, item]) => item.props().disabled)
          .map(([value]) => value),
        onPadOff: (value, details: PadOffEventDetails) => {
          dispatch(context, "onPadOff", value, {
            event: details.event,
            reason: details.reason,
          });
        },
        onPadOn: (value, details: PadOnEventDetails) => {
          const source = sourceOf(details.event);
          // The kernel makes the details the listener sees: its answer is the cancel.
          const canceled = dispatch(context, "onPadOn", value, {
            event: details.event,
            reason: details.reason,
            ...(source ? { source } : {}),
            velocity: details.velocity,
          });
          if (canceled) {
            details.cancel();
          }
        },
        values: ordered.map(([value]) => value),
      };
      controller.setOptions(controllerOptions);
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
      focus: (value: string) => {
        controller.focusPad(value);
        items.get(value)?.el.focus({ preventScroll: true });
      },
      internal: { keyOf: (value: unknown) => String(value) },
      refresh: configure,
      register: (
        value: string,
        el: HTMLElement | null,
        props: () => ItemProps
      ) => {
        if (el) {
          items.set(value, { el, props });
        } else {
          items.delete(value);
        }
        configure();
      },
    };
  },
  name: "pad",
  options: {
    activePads: "value",
    columns: "number",
    disabled: "boolean",
    onPadOff: "callback",
    onPadOn: "callback",
  },
  slots: (slot) => ({
    item: slot<ItemProps, PadItemState>({
      attrs: (state: PadState, { props }) => {
        const disabled = state.view.disabled || Boolean(props.disabled);
        const velocity = state.view.velocities.get(props.value);
        return {
          "data-active": flag(state.view.active.has(props.value)),
          "data-disabled": flag(disabled),
          disabled: flag(disabled),
          style: css({
            "touch-action": "none",
            ...(velocity === undefined
              ? {}
              : { "--pad-velocity": String(velocity) }),
          }),
          tabindex: props.value === state.view.tabStop ? "0" : "-1",
          type: "button",
        };
      },
      bind: (el, part) => {
        part.api.register(part.props.value, el, () => part.props);
        return () =>
          part.api.register(part.props.value, null, () => part.props);
      },
      on: {
        blur: (event, { api, props }) =>
          api.controller.keyOff(props.value, event),
        focus: (_event, { api, props }) => api.controller.focusPad(props.value),
        keydown: (event, { api, props, store }) => {
          api.refresh();
          const disabled = store.get().view.disabled || Boolean(props.disabled);
          if (disabled) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            api.controller.keyOn(
              { chokeGroup: props.chokeGroup, value: props.value },
              event
            );
            return;
          }
          const next = api.controller.navigate(props.value, event);
          if (next !== null) {
            event.preventDefault();
            api.focus(next);
          }
        },
        keyup: (event, { api, props }) => {
          if (event.key === "Enter" || event.key === " ") {
            api.controller.keyOff(props.value, event);
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          api.refresh();
          const disabled = store.get().view.disabled || Boolean(props.disabled);
          if (!el || disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          api.controller.focusPad(props.value);
          el.focus({
            focusVisible: false,
            preventScroll: true,
          } as FocusOptions);
          api.controller.press(
            { chokeGroup: props.chokeGroup, value: props.value },
            event,
            el
          );
        },
      },
      props: { chokeGroup: "string", disabled: "boolean", value: "key" },
      state: (state: PadState, { props }) => ({
        active: state.view.active.has(props.value),
        disabled: state.view.disabled || Boolean(props.disabled),
      }),
    }),
    root: slot<object, PadRootState>({
      attrs: (state: PadState) => ({
        "data-disabled": flag(state.view.disabled),
        role: "group",
      }),
      state: (state: PadState) => ({ disabled: state.view.disabled }),
    }),
  }),
  state: (options: PadPrimitiveOptions): PadState => ({
    view: viewOf(options),
  }),
  sync: () => ({}),
});
