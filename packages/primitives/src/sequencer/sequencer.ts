import type { Source } from "@audio-ui/core";
import {
  type CellAddress,
  cellKey,
  createSequencerController,
  DEFAULT_VELOCITY,
  isOn,
  type Pattern,
  type SequencerController,
  type SequencerOptions,
  type SequencerSnapshot,
  type Velocities,
} from "@audio-ui/core/sequencer";
import {
  createChange,
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { definePrimitive } from "../define.ts";
import {
  type ChangeDetails,
  type CommitDetails,
  flag,
  noop,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../shared.ts";

/**
 * The step sequencer as a UI SDK primitive, over our controller: a grid of
 * steps to switch on and off, one row per sound, painted by dragging, with a
 * velocity bar under each step. It holds two values, the pattern and the
 * velocities, each controlled or its own.
 *
 * A cell and a velocity bar are written by the app with their `row` and their
 * `step`; the primitive keys them by the pair, as `cell`. The step being
 * played comes from a `source` and is marked on its cells straight in the
 * DOM, with `data-current`, so a clock ticking every step renders nothing.
 */

export interface SequencerPrimitiveOptions
  extends Omit<
    SequencerOptions,
    | "onValueChange"
    | "onValueCommitted"
    | "onVelocityChange"
    | "onVelocityCommitted"
  > {
  onValueChange?: (value: boolean[][], details: ChangeDetails) => void;
  onValueCommitted?: (value: boolean[][], details: CommitDetails) => void;
  onVelocityChange?: (velocities: number[][], details: ChangeDetails) => void;
  onVelocityCommitted?: (
    velocities: number[][],
    details: CommitDetails
  ) => void;
  /** The step being played, a live value followed without a render. */
  source?: Source<number>;
}

export interface SequencerState {
  /** The step being played, followed without a render. */
  source: Source<number> | undefined;
  /** The pattern the app holds, or the sequencer's own. */
  value: Pattern;
  /** The velocities the app holds, or the sequencer's own. */
  velocities: Velocities;
  /** What the controller draws: the pattern, the velocities, the tab stop. */
  view: SequencerSnapshot;
}

/** What a part's className, style and children functions read of the grid. */
export interface SequencerRootState {
  disabled: boolean;
  /** Whether a pointer is painting cells. */
  painting: boolean;
  /** How many rows the pattern has: write a row for each. */
  rows: number;
  /** How many steps a row has: write a cell for each. */
  steps: number;
}

/** What a cell reads of itself. */
export interface CellState {
  disabled: boolean;
  /** Whether the step is on: also `aria-pressed`. */
  on: boolean;
}

/** What a velocity bar reads of itself. */
export interface VelocityState {
  disabled: boolean;
  on: boolean;
  /** How loud the step plays, 0 to 1. */
  velocity: number;
}

/** What a sequencer's `api` gives an adapter. */
export interface SequencerApi {
  /** The cells' elements by `row:step`, which a paint reads to find the one under the pointer. */
  cells: Map<string, HTMLElement>;
  controller: SequencerController;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (cell: unknown) => string };
  /** The step being played, kept here so a cell that binds later marks itself. */
  playing: { step: number | null };
  /** The velocity bars' elements by `row:step`. */
  velocities: Map<string, HTMLElement>;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a part at one step of one row. */
interface AtStep extends PartProps {
  /** `row:step`, which keys the part: the adapter writes it. */
  cell: string;
  row: number;
  step: number;
}

/** The sequencer's slots, by name, with the props and the public state of each. */
export type SequencerSlots = {
  cell: SlotDefinition<SequencerState, SequencerApi, AtStep, CellState>;
  root: SlotDefinition<
    SequencerState,
    SequencerApi,
    PartProps,
    SequencerRootState
  >;
  row: SlotDefinition<
    SequencerState,
    SequencerApi,
    PartProps & { index: number },
    SequencerRootState
  >;
  velocity: SlotDefinition<SequencerState, SequencerApi, AtStep, VelocityState>;
  velocityInput: SlotDefinition<
    SequencerState,
    SequencerApi,
    {
      /** `row:step`, which keys the input: the adapter writes it. */
      cell: string;
      getAriaValueText?: (velocity: number) => string;
      row: number;
      step: number;
    },
    object
  >;
};

/**
 * The type of `sequencer`, written out: the kernel's own types its inferred
 * type would name are not exported, so a declaration could not print it.
 */
export interface SequencerPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: SequencerSlots;
  (
    initialOptions: SequencerPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: SequencerApi;
    get: () => SequencerState;
    types: {
      api: SequencerApi;
      options: SequencerPrimitiveOptions;
      slots: SequencerSlots;
      state: SequencerState;
    };
  };
}

/** What the arrow keys change a velocity by; Page Up and Page Down move five times as far. */
const VELOCITY_STEP = 0.05;
const VELOCITY_LARGE_STEP = 0.25;

/** What a grid with these options shows before anything paints it. */
function viewOf(options: SequencerPrimitiveOptions): SequencerSnapshot {
  const controller = createSequencerController();
  controller.setOptions(options as SequencerOptions);
  return controller.getSnapshot();
}

const rootState = (view: SequencerSnapshot): SequencerRootState => ({
  disabled: view.disabled,
  painting: view.painting,
  rows: view.rows,
  steps: view.steps,
});

const addressOf = (props: { row: number; step: number }): CellAddress => ({
  row: Number(props.row),
  step: Number(props.step),
});

const velocityOf = (view: SequencerSnapshot, cell: CellAddress) =>
  view.velocities[cell.row]?.[cell.step] ?? DEFAULT_VELOCITY;

/** The root element a gesture follows, found from a part inside it. */
const rootOf = (el: HTMLElement | undefined) =>
  el?.closest<HTMLElement>('[data-slot="sequencer"]') ?? undefined;

export const sequencer: SequencerPrimitive = definePrimitive({
  api: (context) => {
    const change = createChange(context);
    const controller: SequencerController = createSequencerController();
    let configured: { value?: Pattern; velocities?: Velocities } = {};
    const configure = () => {
      const options = context.options() as SequencerPrimitiveOptions;
      const { value, velocities } = context.store.get();
      configured = { value, velocities };
      controller.setOptions({
        ...options,
        // The controller always works controlled: the kernel holds both values.
        onValueChange: (next, details) => {
          const source = sourceOf(details.event);
          if (
            !change("value", next, {
              event: details.event,
              reason: details.reason,
              ...(source ? { source } : {}),
            } as never)
          ) {
            details.cancel();
          }
        },
        onValueCommitted: (next, details) => {
          dispatch(context, "onValueCommitted", next, {
            event: details.event,
            reason: details.reason,
          });
        },
        // `createChange` would call `onVelocitiesChange`: this one is named by hand.
        onVelocityChange: (next, details) => {
          const source = sourceOf(details.event);
          const canceled = dispatch(context, "onVelocityChange", next, {
            event: details.event,
            reason: details.reason,
            ...(source ? { source } : {}),
          });
          if (canceled) {
            details.cancel();
            return;
          }
          // Controlled velocities wait for the app to give them back.
          if (
            (context.options() as SequencerPrimitiveOptions).velocities ===
            undefined
          ) {
            context.store.set({ velocities: next });
          }
        },
        onVelocityCommitted: (next, details) => {
          dispatch(context, "onVelocityCommitted", next, {
            event: details.event,
            reason: details.reason,
          });
        },
        value,
        velocities,
      } as SequencerOptions);
      context.store.set({ view: controller.getSnapshot() });
    };
    configure();
    context.onOptions(configure);
    context.onDestroy(
      context.store.subscribe(() => {
        const state = context.store.get();
        if (
          state.value !== configured.value ||
          state.velocities !== configured.velocities
        ) {
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
      cells: new Map<string, HTMLElement>(),
      controller,
      playing: { step: null as number | null },
      internal: { keyOf: (cell: unknown) => String(cell) },
      velocities: new Map<string, HTMLElement>(),
    };
  },
  controlled: ["value", "velocities"],
  name: "sequencer",
  options: {
    defaultValue: "value",
    defaultVelocities: "value",
    disabled: "boolean",
    onValueChange: "callback",
    onValueCommitted: "callback",
    onVelocityChange: "callback",
    onVelocityCommitted: "callback",
    source: "value",
    value: "value",
    velocities: "value",
  },
  slots: (slot) => ({
    cell: slot<AtStep, CellState>({
      attrs: (state: SequencerState, { props }) => {
        const cell = addressOf(props);
        const { view } = state;
        const on = isOn(view.value, cell);
        const stop =
          view.tabStop.row === cell.row && view.tabStop.step === cell.step;
        return {
          "aria-pressed": String(on),
          "data-disabled": flag(view.disabled),
          "data-row": String(cell.row),
          "data-step": String(cell.step),
          "data-on": flag(on),
          "data-painting": flag(view.painting),
          disabled: flag(view.disabled),
          tabindex: stop ? "0" : "-1",
          type: "button",
        };
      },
      bind: (el, part) => {
        const cell = addressOf(part.props);
        const key = cellKey(cell);
        part.api.cells.set(key, el);
        el.toggleAttribute("data-current", part.api.playing.step === cell.step);
        return () => part.api.cells.delete(key);
      },
      on: {
        focus: (_event, { api, props }) =>
          api.controller.setTabStop(addressOf(props)),
        keydown: (event, { api, props, store }) => {
          if (store.get().view.disabled) {
            return;
          }
          const cell = addressOf(props);
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            api.controller.toggleCell(cell, event);
            return;
          }
          const next = api.controller.moveFocusFrom(cell, event);
          if (next) {
            event.preventDefault();
            api.cells.get(cellKey(next))?.focus({ preventScroll: true });
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          const root = rootOf(el);
          if (!root || store.get().view.disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          const cell = addressOf(props);
          root.setPointerCapture?.(event.pointerId);
          api.controller.setTabStop(cell);
          el?.focus({ preventScroll: true });
          api.controller.pressCell(cell, event, root, api.cells);
        },
      },
      props: { cell: "key", row: "number", step: "number" },
      state: (state: SequencerState, { props }) => ({
        disabled: state.view.disabled,
        on: isOn(state.view.value, addressOf(props)),
      }),
    }),
    root: slot<object, SequencerRootState>({
      attrs: (state: SequencerState) => ({
        "data-disabled": flag(state.view.disabled),
        "data-painting": flag(state.view.painting),
        role: "group",
        style: css({ "touch-action": "none" }),
      }),
      // The step being played is marked on its cells without a render.
      bind: (_el, part) => {
        let watched: Source<number> | undefined;
        let stop: () => void = noop;
        const mark = (step: number | null, on: boolean) => {
          if (step === null) {
            return;
          }
          for (const [key, node] of part.api.cells) {
            if (key.endsWith(`:${step}`)) {
              node.toggleAttribute("data-current", on);
            }
          }
        };
        const follow = () => {
          const { source, view } = part.store.get();
          const step = source?.getSnapshot() ?? -1;
          const next = step >= 0 && step < view.steps ? Math.floor(step) : null;
          const previous = part.api.playing.step;
          if (next !== previous) {
            mark(previous, false);
            part.api.playing.step = next;
            mark(next, true);
          }
        };
        const watch = () => {
          const { source } = part.store.get();
          if (source !== watched) {
            stop();
            watched = source;
            stop = source ? source.subscribe(follow) : noop;
          }
          follow();
        };
        watch();
        const off = part.store.subscribe(watch);
        return () => {
          off();
          stop();
          part.api.playing.step = null;
        };
      },
      state: (state: SequencerState) => rootState(state.view),
    }),
    row: slot<{ index: number }, SequencerRootState>({
      attrs: (state: SequencerState) => ({
        "data-disabled": flag(state.view.disabled),
        "data-painting": flag(state.view.painting),
        role: "group",
      }),
      props: { index: "key" },
      state: (state: SequencerState) => rootState(state.view),
    }),
    velocity: slot<AtStep, VelocityState>({
      attrs: (state: SequencerState, { props }) => {
        const cell = addressOf(props);
        return {
          "data-disabled": flag(state.view.disabled),
          "data-on": flag(isOn(state.view.value, cell)),
          "data-velocity": String(velocityOf(state.view, cell)),
          style: css({
            "--sequencer-velocity": String(velocityOf(state.view, cell)),
            "touch-action": "none",
          }),
        };
      },
      bind: (el, part) => {
        const key = cellKey(addressOf(part.props));
        part.api.velocities.set(key, el);
        return () => part.api.velocities.delete(key);
      },
      on: {
        // A press draws the velocity where the pointer is, and a drag draws across the row; Alt brings it back to full.
        pointerdown: (event, { api, el, props, store }) => {
          const root = rootOf(el);
          if (!root || store.get().view.disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          el?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
            preventScroll: true,
          });
          const cell = addressOf(props);
          if (event.altKey) {
            api.controller.setVelocity(cell, DEFAULT_VELOCITY, "reset", event);
            return;
          }
          root.setPointerCapture?.(event.pointerId);
          api.controller.pressVelocity(cell, event, root, api.velocities);
        },
      },
      props: { cell: "key", row: "number", step: "number" },
      state: (state: SequencerState, { props }) => {
        const cell = addressOf(props);
        return {
          disabled: state.view.disabled,
          on: isOn(state.view.value, cell),
          velocity: velocityOf(state.view, cell),
        };
      },
    }),
    // The native range input of a velocity bar: it takes the keys and carries the name.
    velocityInput: slot<{
      cell: string;
      getAriaValueText?: (velocity: number) => string;
      row: number;
      step: number;
    }>({
      attrs: (state: SequencerState, { props }) => {
        const velocity = velocityOf(
          state.view,
          addressOf({ row: props.row ?? 0, step: props.step ?? 0 })
        );
        return {
          "aria-valuetext": props.getAriaValueText
            ? props.getAriaValueText(velocity)
            : `${Math.round(velocity * 100)}%`,
          disabled: flag(state.view.disabled),
          max: "1",
          min: "0",
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(velocity),
        };
      },
      on: {
        change: (event, { api, el, props }) =>
          api.controller.setVelocity(
            addressOf(props),
            Number((el as HTMLInputElement).value),
            "input-change",
            event
          ),
        keydown: (event, { api, props, store }) => {
          if (store.get().view.disabled) {
            return;
          }
          const cell = addressOf({
            row: props.row ?? 0,
            step: props.step ?? 0,
          });
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            api.controller.setVelocity(cell, DEFAULT_VELOCITY, "reset", event);
            return;
          }
          const velocity = velocityOf(store.get().view, cell);
          const target = {
            ArrowDown: velocity - VELOCITY_STEP,
            ArrowLeft: velocity - VELOCITY_STEP,
            ArrowRight: velocity + VELOCITY_STEP,
            ArrowUp: velocity + VELOCITY_STEP,
            End: 1,
            Home: 0,
            PageDown: velocity - VELOCITY_LARGE_STEP,
            PageUp: velocity + VELOCITY_LARGE_STEP,
          }[event.key];
          if (target === undefined) {
            return;
          }
          event.preventDefault();
          api.controller.setVelocity(cell, target, "keyboard", event);
        },
      },
      // Written by the adapter from its velocity bar, so the input is the step's own.
      props: {
        cell: "key",
        getAriaValueText: "value",
        row: "number",
        step: "number",
      },
    }),
  }),
  state: (options: SequencerPrimitiveOptions): SequencerState => {
    const view = viewOf(options);
    return {
      source: options.source,
      value: view.value,
      velocities: view.velocities,
      view,
    };
  },
  sync: (options: SequencerPrimitiveOptions) => ({
    source: options.source,
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.velocities === undefined
      ? {}
      : { velocities: options.velocities }),
  }),
});
