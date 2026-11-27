import {
  createChange,
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { clamp } from "@ui-sdk/core/number";
import {
  type ChangeDetails,
  type CommitDetails,
  createGestures,
  definePrimitive,
  flag,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../primitive";

export type { ChangeDetails, CommitDetails } from "../primitive";

/**
 * The step sequencer: a grid of steps to switch on and off, one row per
 * sound, painted by dragging, with a velocity bar under each step. It holds
 * two values, the pattern and the velocities, each controlled or its own.
 *
 * A cell and a velocity bar are written by the app with their `row` and their
 * `step`; the primitive keys them by the pair, as `cell`. The step being
 * played comes from a `source` and is marked on its cells straight in the
 * DOM, with `data-current`, so a clock ticking every step renders nothing.
 */

/** Which steps are on: a row per sound, a cell per step. */
export type Pattern = readonly (readonly boolean[])[];

/** Loudness per step, 0 to 1: a row per sound, like the pattern. A step it does not list is at full. */
export type Velocities = readonly (readonly number[])[];

/** A cell of the grid: its row and its step. */
export interface CellAddress {
  row: number;
  step: number;
}

/** The step being played, a live value an engine pushes to. */
export interface StepSource {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

/** What a step plays at until it is set. */
const DEFAULT_VELOCITY = 1;
/** What the arrow keys change a velocity by; Page Up and Page Down move five times as far. */
const VELOCITY_STEP = 0.05;
const VELOCITY_LARGE_STEP = 0.25;
/** A drag between two frames is followed in steps this long, in px, so a quick stroke misses no cell. */
const STROKE_SAMPLE_PX = 4;

const EMPTY: readonly never[] = [];

const cellKey = ({ row, step }: CellAddress) => `${row}:${step}`;

const isOn = (pattern: Pattern, { row, step }: CellAddress) =>
  pattern[row]?.[step] === true;

const velocityAt = (velocities: Velocities, { row, step }: CellAddress) =>
  velocities[row]?.[step] ?? DEFAULT_VELOCITY;

/** `pattern` with one cell set. */
const setCell = (pattern: Pattern, { row, step }: CellAddress, on: boolean) =>
  pattern.map((cells, at) =>
    at === row
      ? cells.map((cell, index) => (index === step ? on : cell))
      : [...cells]
  );

/** `velocities` with one step set, grown to `rows` by `steps`. */
const setVelocity = (
  velocities: Velocities,
  { row, step }: CellAddress,
  velocity: number,
  rows: number,
  steps: number
) =>
  Array.from({ length: rows }, (_, rowAt) =>
    Array.from({ length: steps }, (_step, stepAt) =>
      rowAt === row && stepAt === step
        ? velocity
        : velocityAt(velocities, { row: rowAt, step: stepAt })
    )
  );

/** The velocity a press at `clientY` sets on a bar: its bottom is silent, its top full. */
const velocityAtY = (box: DOMRect, clientY: number) =>
  box.height <= 0
    ? DEFAULT_VELOCITY
    : clamp((box.bottom - clientY) / box.height, 0, 1);

/** Where an arrow, Home or End key takes the focus from `from`, kept inside the grid. */
function moveFocus(
  from: CellAddress,
  key: string,
  rows: number,
  steps: number,
  ctrlKey: boolean
): CellAddress | null {
  const last = { row: Math.max(0, rows - 1), step: Math.max(0, steps - 1) };
  switch (key) {
    case "ArrowLeft":
      return { ...from, step: Math.max(0, from.step - 1) };
    case "ArrowRight":
      return { ...from, step: Math.min(last.step, from.step + 1) };
    case "ArrowUp":
      return { ...from, row: Math.max(0, from.row - 1) };
    case "ArrowDown":
      return { ...from, row: Math.min(last.row, from.row + 1) };
    case "Home":
      return ctrlKey ? { row: 0, step: 0 } : { ...from, step: 0 };
    case "End":
      return ctrlKey ? last : { ...from, step: last.step };
    default:
      return null;
  }
}

/** The cell whose element holds the point. */
function cellAtPoint(
  nodes: ReadonlyMap<string, Element>,
  x: number,
  y: number
): CellAddress | null {
  for (const [key, node] of nodes) {
    const box = node.getBoundingClientRect();
    if (x >= box.left && x < box.right && y >= box.top && y < box.bottom) {
      const [row, step] = key.split(":").map(Number);
      return { row: row ?? 0, step: step ?? 0 };
    }
  }
  return null;
}

/** The points of a stroke from `from` to `to`, close enough together to touch every cell it crosses. */
function strokePoints(from: { x: number; y: number }, x: number, y: number) {
  const count = Math.max(
    1,
    Math.ceil(Math.hypot(x - from.x, y - from.y) / STROKE_SAMPLE_PX)
  );
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / count;
    return { x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t };
  });
}

export interface SequencerPrimitiveOptions {
  /** Uncontrolled starting pattern: a row per sound, each a list of steps. */
  defaultValue?: Pattern;
  /** Uncontrolled starting velocities. */
  defaultVelocities?: Velocities;
  disabled?: boolean;
  onValueChange?: (value: boolean[][], details: ChangeDetails) => void;
  onValueCommitted?: (value: boolean[][], details: CommitDetails) => void;
  onVelocityChange?: (velocities: number[][], details: ChangeDetails) => void;
  onVelocityCommitted?: (
    velocities: number[][],
    details: CommitDetails
  ) => void;
  /** The step being played, a live value followed without a render. */
  source?: StepSource;
  /** The pattern: a row per sound, each a list of steps. */
  value?: Pattern;
  /** How loud each step plays, 0 to 1, a row per sound like the pattern. */
  velocities?: Velocities;
}

export interface SequencerState {
  disabled: boolean;
  /**
   * The pattern and the velocities as the gesture under way left them: a
   * controlled value that lags behind must not pull them back mid-gesture.
   * The options take over again whenever they change.
   */
  draftValue: Pattern | null;
  draftVelocities: Velocities | null;
  /** Whether a pointer is painting cells. */
  painting: boolean;
  /** The step being played, followed without a render. */
  source: StepSource | undefined;
  /** The cell the arrow keys start from: the one tab stop among the cells. */
  tabStop: CellAddress;
  /** The pattern the app holds, or the sequencer's own. */
  value: Pattern;
  /** The velocities the app holds, or the sequencer's own. */
  velocities: Velocities;
}

/** What a view draws the sequencer from. */
export interface SequencerSnapshot {
  disabled: boolean;
  painting: boolean;
  rows: number;
  steps: number;
  /** The tab stop, kept inside the grid whatever its size now. */
  tabStop: CellAddress;
  value: Pattern;
  velocities: Velocities;
}

const views = new WeakMap<SequencerState, SequencerSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: SequencerState): SequencerSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const rows = state.value.length;
  const steps = state.value[0]?.length ?? 0;
  const view: SequencerSnapshot = {
    disabled: state.disabled,
    painting: state.painting,
    rows,
    steps,
    tabStop: {
      row: Math.min(state.tabStop.row, Math.max(0, rows - 1)),
      step: Math.min(state.tabStop.step, Math.max(0, steps - 1)),
    },
    value: state.value,
    velocities: state.velocities,
  };
  views.set(state, view);
  return view;
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
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (cell: unknown) => string };
  /** Where an arrow, Home or End key takes the focus from `from`: the new tab stop, or null when the key is not the grid's. */
  moveFocusFrom: (
    from: CellAddress,
    event: KeyboardEvent
  ) => CellAddress | null;
  /** The step being played, kept here so a cell that binds later marks itself. */
  playing: { step: number | null };
  /** Starts a press on a cell: a drag paints the cells the pointer crosses with the opposite of the first one's state. */
  pressCell: (
    cell: CellAddress,
    event: PointerEvent,
    root: HTMLElement
  ) => void;
  /** Starts a press on a step's velocity bar: a drag draws the velocities of the steps it crosses in that row. */
  pressVelocity: (
    cell: CellAddress,
    event: PointerEvent,
    root: HTMLElement
  ) => void;
  /** Moves the tab stop, without focusing anything. */
  setTabStop: (cell: CellAddress) => void;
  /** Sets one step's velocity and commits it at once: a key, an input or a reset. */
  setVelocity: (
    cell: CellAddress,
    velocity: number,
    reason: string,
    event: Event
  ) => void;
  /** Flips a cell from the keyboard, and commits it. */
  toggleCell: (cell: CellAddress, event: KeyboardEvent) => void;
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

const rootState = (state: SequencerState): SequencerRootState => {
  const view = viewOf(state);
  return {
    disabled: view.disabled,
    painting: view.painting,
    rows: view.rows,
    steps: view.steps,
  };
};

const addressOf = (props: { row?: number; step?: number }): CellAddress => ({
  row: Number(props.row ?? 0),
  step: Number(props.step ?? 0),
});

/** The root element a gesture follows, found from a part inside it. */
const rootOf = (el: HTMLElement | undefined) =>
  el?.closest<HTMLElement>('[data-slot="sequencer"]') ?? undefined;

/** One pointer gesture: a paint on the cells, or a draw on one row's velocity bars. */
interface Gesture {
  /** Whether it changed anything; if so its end commits. */
  changed: boolean;
  kind: "paint" | "velocity";
  /** Where the pointer was at the last move. */
  last: { x: number; y: number };
  /** The state a paint sets each cell it crosses to. */
  on: boolean;
  /** The row a velocity draw stays in. */
  row: number;
}

/** What the options give the state, whatever the gestures did: a draft gives way to them. */
const optionsState = (options: SequencerPrimitiveOptions) => ({
  disabled: options.disabled ?? false,
  draftValue: null,
  draftVelocities: null,
  source: options.source,
  ...(options.value === undefined ? {} : { value: options.value }),
  ...(options.velocities === undefined
    ? {}
    : { velocities: options.velocities }),
});

export const sequencer: SequencerPrimitive = definePrimitive({
  api: (context) => {
    const change = createChange(context);
    const state = () => context.store.get() as SequencerState;
    const set = (next: Partial<SequencerState>) =>
      context.store.set(next as never);
    const options = () => context.options() as SequencerPrimitiveOptions;
    const cells = new Map<string, HTMLElement>();
    const velocities = new Map<string, HTMLElement>();
    const gestures = createGestures<Gesture>(context);

    /** The pattern and velocities as the gesture under way left them. */
    const currentValue = () => state().draftValue ?? state().value;
    const currentVelocities = () =>
      state().draftVelocities ?? state().velocities;

    /** Sets one cell, if it differs; says whether the change went through. */
    const setCellTo = (
      cell: CellAddress,
      on: boolean,
      reason: string,
      event: Event
    ) => {
      const current = currentValue();
      if (isOn(current, cell) === on) {
        return false;
      }
      const next = setCell(current, cell, on);
      const source = sourceOf(event);
      if (
        !change(
          "value",
          next as never,
          {
            event,
            reason,
            ...(source ? { source } : {}),
          } as never
        )
      ) {
        return false;
      }
      set({ draftValue: next });
      return true;
    };

    const commitValue = (reason: string, event: Event) =>
      dispatch(context, "onValueCommitted", currentValue(), { event, reason });

    /** Sets one step's velocity, if it differs; says whether the change went through. */
    const changeVelocity = (
      cell: CellAddress,
      velocity: number,
      reason: string,
      event: Event
    ) => {
      const current = currentVelocities();
      const pattern = currentValue();
      const next = setVelocity(
        current,
        cell,
        clamp(velocity, 0, 1),
        pattern.length,
        pattern[0]?.length ?? 0
      );
      if (next[cell.row]?.[cell.step] === velocityAt(current, cell)) {
        return false;
      }
      const source = sourceOf(event);
      // `createChange` would call `onVelocitiesChange`: this one is named by hand.
      if (
        dispatch(context, "onVelocityChange", next, {
          event,
          reason,
          ...(source ? { source } : {}),
        })
      ) {
        return false;
      }
      // Controlled velocities wait for the app to give them back.
      set(
        options().velocities === undefined
          ? { draftVelocities: next, velocities: next }
          : { draftVelocities: next }
      );
      return true;
    };

    const commitVelocities = (reason: string, event: Event) =>
      dispatch(context, "onVelocityCommitted", currentVelocities(), {
        event,
        reason,
      });

    /** Sets the velocity of the step under a point, in the row being drawn. */
    const drawVelocityAt = (
      row: number,
      x: number,
      y: number,
      event: PointerEvent
    ) => {
      for (const [key, node] of velocities) {
        const [nodeRow, nodeStep] = key.split(":").map(Number);
        const box = node.getBoundingClientRect();
        if (nodeRow === row && x >= box.left && x < box.right) {
          return changeVelocity(
            { row, step: nodeStep ?? 0 },
            velocityAtY(box, y),
            "drag",
            event
          );
        }
      }
      return false;
    };

    /** Applies one point of a stroke; says whether it changed anything. */
    const strokeAt = (
      gesture: Gesture,
      x: number,
      y: number,
      event: PointerEvent
    ) => {
      if (gesture.kind === "velocity") {
        return drawVelocityAt(gesture.row, x, y, event);
      }
      const crossed = cellAtPoint(cells, x, y);
      return crossed !== null && setCellTo(crossed, gesture.on, "paint", event);
    };

    /** Ends a gesture, committing what it changed. */
    const finish = (gesture: Gesture, event: PointerEvent) => {
      if (gesture.kind === "paint") {
        set({ painting: false });
        if (gesture.changed) {
          commitValue("paint", event);
        }
      } else if (gesture.changed) {
        commitVelocities("drag", event);
      }
      set({ draftValue: null, draftVelocities: null });
    };

    /** Follows a press on `root` until it lifts, drawing the stroke between moves. */
    const follow = (root: HTMLElement, event: PointerEvent, gesture: Gesture) =>
      gestures.start(root, event, gesture, {
        onEnd: (end) => finish(gesture, end),
        onMove: (move) => {
          for (const point of strokePoints(
            gesture.last,
            move.clientX,
            move.clientY
          )) {
            if (strokeAt(gesture, point.x, point.y, move)) {
              gesture.changed = true;
            }
          }
          gesture.last = { x: move.clientX, y: move.clientY };
        },
      });

    /** Whether a press may start a gesture, ending a stale one of the same pointer first. */
    const accepts = (event: PointerEvent) =>
      !state().disabled &&
      event.button === 0 &&
      gestures.accepts(event, (stale) => finish(stale, event));

    return {
      cells,
      internal: { keyOf: (cell: unknown) => String(cell) },
      moveFocusFrom: (from: CellAddress, event: KeyboardEvent) => {
        const value = currentValue();
        const next = moveFocus(
          from,
          event.key,
          value.length,
          value[0]?.length ?? 0,
          event.ctrlKey || event.metaKey
        );
        if (next) {
          set({ tabStop: next });
        }
        return next;
      },
      playing: { step: null as number | null },
      pressCell: (
        cell: CellAddress,
        event: PointerEvent,
        root: HTMLElement
      ) => {
        if (!accepts(event)) {
          return;
        }
        const gesture: Gesture = {
          changed: false,
          kind: "paint",
          last: { x: event.clientX, y: event.clientY },
          on: !isOn(currentValue(), cell),
          row: cell.row,
        };
        set({ painting: true });
        gesture.changed = setCellTo(cell, gesture.on, "press", event);
        follow(root, event, gesture);
      },
      pressVelocity: (
        cell: CellAddress,
        event: PointerEvent,
        root: HTMLElement
      ) => {
        if (!accepts(event)) {
          return;
        }
        const gesture: Gesture = {
          changed: false,
          kind: "velocity",
          last: { x: event.clientX, y: event.clientY },
          on: false,
          row: cell.row,
        };
        gesture.changed = drawVelocityAt(
          cell.row,
          event.clientX,
          event.clientY,
          event
        );
        follow(root, event, gesture);
      },
      setTabStop: (cell: CellAddress) => set({ tabStop: cell }),
      setVelocity: (
        cell: CellAddress,
        velocity: number,
        reason: string,
        event: Event
      ) => {
        if (changeVelocity(cell, velocity, reason, event)) {
          commitVelocities(reason, event);
        }
        set({ draftVelocities: null });
      },
      toggleCell: (cell: CellAddress, event: KeyboardEvent) => {
        if (setCellTo(cell, !isOn(currentValue(), cell), "keyboard", event)) {
          commitValue("keyboard", event);
        }
        set({ draftValue: null });
      },
      velocities,
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
        const view = viewOf(state);
        const on = isOn(view.value, cell);
        const stop =
          view.tabStop.row === cell.row && view.tabStop.step === cell.step;
        return {
          "aria-pressed": String(on),
          "data-disabled": flag(view.disabled),
          "data-on": flag(on),
          "data-painting": flag(view.painting),
          "data-row": String(cell.row),
          "data-step": String(cell.step),
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
        focus: (_event, { api, props }) => api.setTabStop(addressOf(props)),
        keydown: (event, { api, props, store }) => {
          if (store.get().disabled) {
            return;
          }
          const cell = addressOf(props);
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            api.toggleCell(cell, event);
            return;
          }
          const next = api.moveFocusFrom(cell, event);
          if (next) {
            event.preventDefault();
            api.cells.get(cellKey(next))?.focus({ preventScroll: true });
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          const root = rootOf(el);
          if (!root || store.get().disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          const cell = addressOf(props);
          api.setTabStop(cell);
          el?.focus({ preventScroll: true });
          api.pressCell(cell, event, root);
        },
      },
      props: { cell: "key", row: "number", step: "number" },
      state: (state: SequencerState, { props }) => ({
        disabled: state.disabled,
        on: isOn(state.value, addressOf(props)),
      }),
    }),
    root: slot<object, SequencerRootState>({
      attrs: (state: SequencerState) => ({
        "data-disabled": flag(state.disabled),
        "data-painting": flag(state.painting),
        role: "group",
        // For a stylesheet to lay each row's cells out in a line.
        style: css({
          "--sequencer-steps": String(viewOf(state).steps),
          "touch-action": "none",
        }),
      }),
      // The step being played is marked on its cells without a render.
      bind: (_el, part) => {
        let watched: StepSource | undefined;
        let stop: () => void = () => undefined;
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
          const current = part.store.get();
          const step = current.source?.getSnapshot() ?? -1;
          const next =
            step >= 0 && step < viewOf(current).steps ? Math.floor(step) : null;
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
            stop = source ? source.subscribe(follow) : () => undefined;
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
      state: (state: SequencerState) => rootState(state),
    }),
    row: slot<{ index: number }, SequencerRootState>({
      attrs: (state: SequencerState) => ({
        "data-disabled": flag(state.disabled),
        "data-painting": flag(state.painting),
        role: "group",
      }),
      props: { index: "key" },
      state: (state: SequencerState) => rootState(state),
    }),
    velocity: slot<AtStep, VelocityState>({
      attrs: (state: SequencerState, { props }) => {
        const cell = addressOf(props);
        const velocity = velocityAt(state.velocities, cell);
        return {
          "data-disabled": flag(state.disabled),
          "data-on": flag(isOn(state.value, cell)),
          "data-velocity": String(velocity),
          style: css({
            "--sequencer-velocity": String(velocity),
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
          if (!root || store.get().disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          el?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
            preventScroll: true,
          });
          const cell = addressOf(props);
          if (event.altKey) {
            api.setVelocity(cell, DEFAULT_VELOCITY, "reset", event);
            return;
          }
          api.pressVelocity(cell, event, root);
        },
      },
      props: { cell: "key", row: "number", step: "number" },
      state: (state: SequencerState, { props }) => {
        const cell = addressOf(props);
        return {
          disabled: state.disabled,
          on: isOn(state.value, cell),
          velocity: velocityAt(state.velocities, cell),
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
        const velocity = velocityAt(state.velocities, addressOf(props));
        return {
          "aria-valuetext": props.getAriaValueText
            ? props.getAriaValueText(velocity)
            : `${Math.round(velocity * 100)}%`,
          disabled: flag(state.disabled),
          max: "1",
          min: "0",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(velocity),
        };
      },
      // `step` is set once, as a property: in the attributes it would share its name with this part's own `step` prop, which the custom element re-renders on without end.
      bind: (el) => {
        (el as HTMLInputElement).step = "any";
      },
      on: {
        change: (event, { api, el, props }) =>
          api.setVelocity(
            addressOf(props),
            Number((el as HTMLInputElement).value),
            "input-change",
            event
          ),
        keydown: (event, { api, props, store }) => {
          if (store.get().disabled) {
            return;
          }
          const cell = addressOf(props);
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            api.setVelocity(cell, DEFAULT_VELOCITY, "reset", event);
            return;
          }
          const velocity = velocityAt(store.get().velocities, cell);
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
          api.setVelocity(cell, target, "keyboard", event);
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
  state: (options: SequencerPrimitiveOptions): SequencerState => ({
    disabled: options.disabled ?? false,
    draftValue: null,
    draftVelocities: null,
    painting: false,
    source: options.source,
    tabStop: { row: 0, step: 0 },
    value: options.value ?? options.defaultValue ?? EMPTY,
    velocities: options.velocities ?? options.defaultVelocities ?? EMPTY,
  }),
  sync: optionsState,
});
