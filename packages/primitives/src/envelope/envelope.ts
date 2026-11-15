import {
  type Breakpoint,
  createEnvelopeController,
  type EnvelopeController,
  type EnvelopeOptions,
  type EnvelopeSnapshot,
  polylinePoints,
  segmentShape,
} from "@audio-ui/core/envelope";
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
} from "../shared.ts";

/**
 * The breakpoint envelope as a UI SDK primitive, over our controller, as the
 * knob is: the drag of a point, the bend of a segment, the keys, the grid, the
 * additions and the removals within the least and most points stay in the
 * controller; the primitive routes the elements' events to it and its changes
 * through the kernel.
 *
 * The points are `{ x, y, curve? }`, each normalized to 0…1 on both axes and
 * kept sorted by `x`. A point and a segment are keyed by their `index`, as the
 * items of a collection: the app writes one part for each.
 */

export interface EnvelopePrimitiveOptions
  extends Omit<EnvelopeOptions, "onValueChange" | "onValueCommitted"> {
  onValueChange?: (value: Breakpoint[], details: ChangeDetails) => void;
  onValueCommitted?: (value: Breakpoint[], details: CommitDetails) => void;
}

export interface EnvelopeState {
  /** The roving tab stop among the points. */
  focused: number;
  /** The roving tab stop among the segments' handles. */
  focusedSegment: number;
  /** The points the app holds, or the envelope's own. */
  value: Breakpoint[];
  /** What the controller draws: the points as displayed, the drags, the feedback. */
  view: EnvelopeSnapshot;
}

/** What an envelope with these options shows before anything moves it. */
function viewOf(options: EnvelopePrimitiveOptions): EnvelopeSnapshot {
  const controller = createEnvelopeController();
  controller.setOptions(options as EnvelopeOptions);
  return controller.getSnapshot();
}

/** The state attributes every part carries, as the published envelope writes them. */
const stateAttrs = (view: EnvelopeSnapshot) => ({
  "data-disabled": flag(view.disabled),
  "data-dragging": flag(view.dragging),
});

/** What a part's className, style and children functions read. */
export interface EnvelopePublicState {
  /** Briefly true after an addition was refused at `maxPoints`. */
  blocked: boolean;
  disabled: boolean;
  /** Whether a point or a segment is being dragged. */
  dragging: boolean;
  /** The points, sorted by `x`. */
  value: Breakpoint[];
}

/** What the line and the fill read: the state and the `points` of their polyline. */
export interface ShapeState extends EnvelopePublicState {
  points: string;
}

/** What a point reads of itself. */
export interface PointState {
  /** Briefly true after a removal was refused at `minPoints`. */
  blocked: boolean;
  disabled: boolean;
  dragging: boolean;
  index: number;
  /** Whether the point can be removed now. */
  removable: boolean;
  value: Breakpoint[];
}

/** What a segment reads of itself. */
export interface SegmentState {
  /** The bend, from -1 to 1. */
  curve: number;
  disabled: boolean;
  dragging: boolean;
  /** Whether it joins two points of the same level, so there is nothing to bend. */
  flat: boolean;
  index: number;
  value: Breakpoint[];
}

const publicState = (view: EnvelopeSnapshot): EnvelopePublicState => ({
  blocked: view.isAddBlocked,
  disabled: view.disabled,
  dragging: view.dragging,
  value: view.value,
});

const pointState = (view: EnvelopeSnapshot, index: number): PointState => ({
  blocked: view.blockedIndex === index,
  disabled: view.disabled,
  dragging: view.draggingIndex === index,
  index,
  removable: view.value.length > view.minPoints,
  value: view.value,
});

const segmentState = (view: EnvelopeSnapshot, index: number): SegmentState => {
  const from = view.value[index];
  const to = view.value[index + 1];
  return {
    curve: from?.curve ?? 0,
    disabled: view.disabled,
    dragging: view.draggingSegmentIndex === index,
    flat: from && to ? Math.abs(to.y - from.y) < 1e-6 : true,
    index,
    value: view.value,
  };
};

/** What an envelope's `api` gives an adapter. */
export interface EnvelopeApi {
  /** Adds a point at `at`, 0…1 of the graph, and moves the tab stop to it. */
  addPoint: (at: { x: number; y: number }, event: MouseEvent) => void;
  controller: EnvelopeController;
  focusPoint: (index: number) => void;
  focusSegment: (index: number) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (index: unknown) => string };
  /** The element of each point, to move the focus to. */
  points: Map<number, HTMLElement>;
  /** Removes a point, and moves the tab stop to the one that takes its place. */
  removePoint: (index: number, event: MouseEvent | KeyboardEvent) => void;
  segments: Map<number, HTMLElement>;
  /** Moves the points from outside, as a property does: no change is reported. */
  set: (points: Breakpoint[]) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a point. */
interface PointProps extends PartProps {
  getAriaValueText?: (point: Breakpoint, index: number) => string;
  index: number;
}

/** The props of a segment's handle: the index of the point it leaves from. */
interface SegmentProps extends PartProps {
  getAriaValueText?: (curve: number, index: number) => string;
  index: number;
}

/** The props of a drawing part. */
interface ShapeProps extends PartProps {
  strokeWidth?: number;
}

/** The envelope's slots, by name, with the props and the public state of each. */
export type EnvelopeSlots = {
  fill: SlotDefinition<EnvelopeState, EnvelopeApi, ShapeProps, ShapeState>;
  graph: SlotDefinition<
    EnvelopeState,
    EnvelopeApi,
    PartProps,
    EnvelopePublicState
  >;
  line: SlotDefinition<EnvelopeState, EnvelopeApi, ShapeProps, ShapeState>;
  point: SlotDefinition<EnvelopeState, EnvelopeApi, PointProps, PointState>;
  root: SlotDefinition<
    EnvelopeState,
    EnvelopeApi,
    PartProps,
    EnvelopePublicState
  >;
  segment: SlotDefinition<
    EnvelopeState,
    EnvelopeApi,
    SegmentProps,
    SegmentState
  >;
};

/**
 * The type of `envelope`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface EnvelopePrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: EnvelopeSlots;
  (
    initialOptions: EnvelopePrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: EnvelopeApi;
    get: () => EnvelopeState;
    types: {
      api: EnvelopeApi;
      options: EnvelopePrimitiveOptions;
      slots: EnvelopeSlots;
      state: EnvelopeState;
    };
  };
}

const GRAPH = '[data-slot="envelope-graph"]';

/** The graph a point or a segment is dragged over, found from the point's element. */
const graphOf = (el: HTMLElement | undefined) =>
  el?.closest('[data-slot="envelope"]')?.querySelector<HTMLElement>(GRAPH) ??
  undefined;

/** A pointer's place in the graph, 0…1 from the left and from the bottom, or null while it has no size. */
function pointOf(event: MouseEvent, graph: HTMLElement) {
  const rect = graph.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: 1 - (event.clientY - rect.top) / rect.height,
  };
}

const SHAPE_STYLE = css({
  height: "100%",
  inset: "0",
  position: "absolute",
  width: "100%",
});

/** What a drawing part is: an `<svg>` over the graph, stretched to it, holding one polyline. */
const shapeAttrs = (state: EnvelopeState) => ({
  ...stateAttrs(state.view),
  "aria-hidden": "true",
  preserveAspectRatio: "none",
  style: SHAPE_STYLE,
  viewBox: "0 0 100 100",
});

export const envelope: EnvelopePrimitive = definePrimitive({
  api: (context) => {
    const controller: EnvelopeController = createEnvelopeController();
    connectController(context, controller);
    context.onDestroy(() => controller.dispose());
    const points = new Map<number, HTMLElement>();
    const segments = new Map<number, HTMLElement>();
    const focusPoint = (index: number) => {
      context.store.set({ focused: index });
      points.get(index)?.focus();
    };
    return {
      addPoint: (at: { x: number; y: number }, event: MouseEvent) => {
        const index = controller.addPointAt(at, event);
        if (index !== null) {
          context.store.set({ focused: index });
        }
      },
      controller,
      focusPoint,
      focusSegment: (index: number) => {
        const last = Math.max(0, context.store.get().view.value.length - 2);
        const target = Math.min(last, Math.max(0, index));
        context.store.set({ focusedSegment: target });
        segments.get(target)?.focus();
      },
      internal: { keyOf: (index: unknown) => String(index) },
      points,
      removePoint: (index: number, event: MouseEvent | KeyboardEvent) => {
        if (!controller.removePoint(index, event)) {
          return;
        }
        focusPoint(Math.min(index, controller.getSnapshot().value.length - 1));
      },
      segments,
      set: (value: Breakpoint[]) => context.store.set({ value }),
    };
  },
  controlled: ["value"],
  name: "envelope",
  options: {
    defaultValue: "value",
    disabled: "boolean",
    format: "value",
    locale: "value",
    maxPoints: "number",
    minPoints: "number",
    onValueChange: "callback",
    onValueCommitted: "callback",
    snap: "value",
    step: "number",
    value: "value",
  },
  slots: (slot) => ({
    fill: slot<ShapeProps, ShapeState>({
      attrs: shapeAttrs,
      props: { strokeWidth: "number" },
      state: (state: EnvelopeState) => ({
        ...publicState(state.view),
        points: shapePoints(state.view.value, true),
      }),
    }),
    graph: slot<object, EnvelopePublicState>({
      attrs: (state: EnvelopeState) => ({
        ...stateAttrs(state.view),
        "data-blocked": flag(state.view.isAddBlocked),
        style: css({ position: "relative" }),
      }),
      on: {
        // A double click adds a point; with Alt it straightens the segment under it.
        dblclick: (event, { api, el }) => {
          const at = el ? pointOf(event, el) : null;
          if (!at) {
            return;
          }
          if (event.altKey) {
            api.controller.straightenAt(at, event);
            return;
          }
          api.addPoint(at, event);
        },
        // With Alt held, a drag bends the segment under the pointer.
        pointerdown: (event, { api, el }) => {
          if (
            !el ||
            api.controller.getSnapshot().disabled ||
            !event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          api.controller.pressBend(event, el);
        },
      },
      state: (state: EnvelopeState) => publicState(state.view),
    }),
    line: slot<ShapeProps, ShapeState>({
      attrs: shapeAttrs,
      props: { strokeWidth: "number" },
      state: (state: EnvelopeState) => ({
        ...publicState(state.view),
        points: shapePoints(state.view.value, false),
      }),
    }),
    point: slot<PointProps, PointState>({
      attrs: (state: EnvelopeState, { api, props }) => {
        const index = Number(props.index);
        const point = state.view.value[index];
        const current = pointState(state.view, index);
        return {
          ...stateAttrs(state.view),
          "aria-disabled": state.view.disabled ? "true" : undefined,
          "aria-valuemax": "1",
          "aria-valuemin": "0",
          "aria-valuenow": point ? String(point.y) : undefined,
          "aria-valuetext": point
            ? (props.getAriaValueText?.(point, index) ??
              api.controller.formatPoint(point.x, point.y))
            : undefined,
          "data-blocked": flag(current.blocked),
          "data-index": String(index),
          "data-removable": flag(current.removable),
          role: "slider",
          style: css({
            bottom: `${(point?.y ?? 0) * 100}%`,
            left: `${(point?.x ?? 0) * 100}%`,
            position: "absolute",
            "touch-action": "none",
            transform: "translate(-50%, 50%)",
          }),
          tabindex: state.view.disabled || index !== state.focused ? "-1" : "0",
        };
      },
      bind: (el, part) => {
        const index = Number(part.props.index);
        part.api.points.set(index, el);
        return () => part.api.points.delete(index);
      },
      on: {
        // A double click removes the point.
        dblclick: (event, { api, props }) => {
          event.stopPropagation();
          api.removePoint(Number(props.index), event);
        },
        focus: (_event, { props, store }) =>
          store.set({ focused: Number(props.index) }),
        keydown: (event, { api, props, store }) => {
          if (store.get().view.disabled) {
            return;
          }
          const index = Number(props.index);
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            api.removePoint(index, event);
            return;
          }
          // The points share one tab stop: these keys move between them.
          const last = store.get().view.value.length - 1;
          const moves: Record<string, number> = {
            End: last,
            Home: 0,
            PageDown: Math.max(0, index - 1),
            PageUp: Math.min(last, index + 1),
          };
          const move = moves[event.key];
          if (move !== undefined) {
            event.preventDefault();
            api.focusPoint(move);
            return;
          }
          if (api.controller.keyPoint(index, event)) {
            event.preventDefault();
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          if (store.get().view.disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const index = Number(props.index);
          // Alt + click removes the point, as in a DAW's automation lane.
          if (event.altKey) {
            api.removePoint(index, event);
            return;
          }
          const graph = graphOf(el);
          if (!(el && graph)) {
            return;
          }
          el.focus({
            focusVisible: false,
            preventScroll: true,
          } as FocusOptions);
          store.set({ focused: index });
          api.controller.pressPoint(index, event, el, graph);
        },
      },
      present: (state: EnvelopeState, { props }) =>
        Number(props.index) < state.view.value.length,
      props: { getAriaValueText: "value", index: "key" },
      state: (state: EnvelopeState, { props }) =>
        pointState(state.view, Number(props.index)),
    }),
    root: slot<object, EnvelopePublicState>({
      attrs: (state: EnvelopeState) => ({
        ...stateAttrs(state.view),
        style: css({ position: "relative" }),
      }),
      state: (state: EnvelopeState) => publicState(state.view),
    }),
    segment: slot<SegmentProps, SegmentState>({
      attrs: (state: EnvelopeState, { props }) => {
        const index = Number(props.index);
        const from = state.view.value[index];
        const to = state.view.value[index + 1];
        const current = segmentState(state.view, index);
        const midX = from && to ? (from.x + to.x) / 2 : 0;
        const midY =
          from && to
            ? from.y + (to.y - from.y) * segmentShape(0.5, from.curve)
            : 0;
        return {
          ...stateAttrs(state.view),
          "aria-disabled":
            state.view.disabled || current.flat ? "true" : undefined,
          "aria-valuemax": "1",
          "aria-valuemin": "-1",
          "aria-valuenow": String(current.curve),
          "aria-valuetext": props.getAriaValueText
            ? props.getAriaValueText(current.curve, index)
            : String(Math.round(current.curve * 100) / 100),
          "data-curve": String(current.curve),
          "data-flat": flag(current.flat),
          "data-index": String(index),
          role: "slider",
          style: css({
            bottom: `${midY * 100}%`,
            left: `${midX * 100}%`,
            position: "absolute",
            "touch-action": "none",
            transform: "translate(-50%, 50%)",
          }),
          tabindex:
            state.view.disabled || index !== state.focusedSegment ? "-1" : "0",
        };
      },
      bind: (el, part) => {
        const index = Number(part.props.index);
        part.api.segments.set(index, el);
        return () => part.api.segments.delete(index);
      },
      on: {
        // A double click straightens the segment.
        dblclick: (event, { api, props }) => {
          event.stopPropagation();
          api.controller.straightenSegment(Number(props.index), event);
        },
        focus: (_event, { props, store }) =>
          store.set({ focusedSegment: Number(props.index) }),
        keydown: (event, { api, props, store }) => {
          if (store.get().view.disabled) {
            return;
          }
          const index = Number(props.index);
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            api.focusSegment(index + (event.key === "ArrowRight" ? 1 : -1));
            return;
          }
          if (api.controller.keySegment(index, event)) {
            event.preventDefault();
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          const index = Number(props.index);
          const flat = segmentState(store.get().view, index).flat;
          if (store.get().view.disabled || flat || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const graph = graphOf(el);
          if (!(el && graph)) {
            return;
          }
          el.focus({
            focusVisible: false,
            preventScroll: true,
          } as FocusOptions);
          store.set({ focusedSegment: index });
          api.controller.pressSegment(index, event, el, graph);
        },
      },
      present: (state: EnvelopeState, { props }) =>
        Number(props.index) < state.view.value.length - 1,
      props: { getAriaValueText: "value", index: "key" },
      state: (state: EnvelopeState, { props }) =>
        segmentState(state.view, Number(props.index)),
    }),
  }),
  state: (options: EnvelopePrimitiveOptions): EnvelopeState => {
    const view = viewOf(options);
    return { focused: 0, focusedSegment: 0, value: view.value, view };
  },
  // What the options give, not the tab stops the parts moved.
  sync: (options: EnvelopePrimitiveOptions) =>
    options.value === undefined ? {} : { value: options.value },
});

/** The `points` of a polyline through the points; for a fill, closed down to the baseline. */
function shapePoints(value: Breakpoint[], closed: boolean) {
  const points = polylinePoints(value);
  if (!closed) {
    return points;
  }
  return points ? `${points} 100,100 0,100` : "";
}
