import {
  css,
  dispatch,
  type PrimitiveContext,
  type SlotDefinition,
} from "@ui-sdk/core";
import { flag, sourceOf, VISUALLY_HIDDEN } from "../primitive";
import { laneOf, placedOver } from "./layout";
import {
  createRangeController,
  type RangeController,
} from "./range-controller";
import type {
  DescribePosition,
  TimelineApi,
  TimelinePublicState,
  TimelineState,
} from "./timeline";

/**
 * The ranges of the timeline: a stretch laid over a lane, such as a loop or a
 * selection. A range is named by its `range` prop and holds a controller of
 * its own; its edges and its input carry the same name, and what they report
 * goes through the Root, `onRangeChange` and `onRangeCommitted`, with the
 * name and the edge in the details.
 */

export type RangeValue = readonly [number, number];

/** The props every part of a range takes. */
export interface RangeRef {
  id?: string;
  /** The name of the range it belongs to. */
  range: string;
}

/** The props of the range part: its name, and what it holds. */
export interface RangeProps extends RangeRef {
  defaultValue?: RangeValue;
  disabled?: boolean;
  /** Whether dragging across empty lane draws a new range. @default false */
  drawable?: boolean;
  /** The least room the range is drawn with, in px. @default 0 */
  minDrawnWidth?: number;
  /** The shortest the range can be. Defaults to the grid step. */
  minLength?: number;
  /** Whether dragging the body, or the keys, moves the range. @default true */
  movable?: boolean;
  value?: RangeValue;
}

export interface RangePublicState extends TimelinePublicState {
  /** Whether a pointer is moving, resizing or drawing the range. */
  dragging: boolean;
}

export interface RangeEdgeState extends RangePublicState {
  edge: "end" | "start";
}

/** What a range's change reports. */
export interface RangeChangeDetails {
  cancel: () => void;
  edge: "both" | "end" | "start";
  event?: Event;
  /** The name of the range that moved. */
  range: string;
  reason: string;
  source?: string;
}

export interface RangeCommitDetails {
  edge: "both" | "end" | "start";
  event?: Event;
  range: string;
  reason: string;
}

type Slot<Props, Public = RangePublicState> = SlotDefinition<
  TimelineState,
  TimelineApi,
  Props,
  Public
>;

type InputSlot = Slot<
  RangeRef & { getAriaValueText?: DescribePosition },
  object
>;

/** The range slots, by name. */
export type RangeSlots = {
  range: Slot<RangeProps>;
  rangeEnd: Slot<RangeRef, RangeEdgeState>;
  rangeEndInput: InputSlot;
  rangeInput: InputSlot;
  rangeStart: Slot<RangeRef, RangeEdgeState>;
  rangeStartInput: InputSlot;
};

/** What the timeline's `api` gives the range parts. */
export interface RangeApi {
  /** The controller of the range named in `props`; the range part's own props give it its options. */
  rangeFor: (
    state: TimelineState,
    props: RangeProps | RangeRef,
    owner?: boolean
  ) => RangeController;
  /** What each range was given by its own part. */
  rangeProps: Map<string, RangeProps>;
}

const describeNumber = (value: number) => String(Math.round(value * 100) / 100);

export function createRangeApi(
  context: PrimitiveContext<any, any, any>,
  settings: () => {
    duration: number;
    grid: { offset: number; points?: readonly number[]; step: number };
    largeStep: number;
    step: number;
  },
  bump: () => void
): RangeApi {
  const controllers = new Map<string, RangeController>();
  const rangeProps = new Map<string, RangeProps>();
  const provisional = new Set<string>();
  /** The controller of a range: made once, and again when the range itself first binds after a part that started it. */
  const controllerFor = (name: string, options: object, owner: boolean) => {
    let controller = controllers.get(name);
    // A part that binds before the range itself starts the controller without what the range was given: the range starts it again, with it.
    if (controller && owner && provisional.has(name)) {
      provisional.delete(name);
      controller = undefined;
      queueMicrotask(bump);
    }
    if (controller) {
      if (owner) {
        controller.setOptions(options as never);
      }
    } else {
      controller = createRangeController(options as never);
      controller.subscribe(bump);
      controllers.set(name, controller);
      if (!owner) {
        provisional.add(name);
      }
    }
    return controller;
  };
  return {
    rangeFor: (state, props, owner = false) => {
      const name = String(props.range);
      const own = props as RangeProps;
      const { duration, grid, largeStep, step } = settings();
      if (owner) {
        rangeProps.set(name, own);
      }
      const options = {
        defaultValue: own.defaultValue,
        disabled: state.view.disabled || Boolean(own.disabled),
        drawable: own.drawable ?? false,
        duration,
        grid,
        largeStep,
        minDrawnWidth: own.minDrawnWidth ?? 0,
        minLength: own.minLength ?? (grid.step > 0 ? grid.step : step),
        movable: own.movable ?? true,
        onValueChange: (
          value: RangeValue,
          details: { cancel: () => void; event?: Event; reason: string }
        ) => {
          const { cancel, ...rest } = details;
          const source = sourceOf(details.event);
          if (
            dispatch(context, "onRangeChange", value, {
              ...rest,
              range: name,
              ...(source ? { source } : {}),
            })
          ) {
            cancel();
          }
        },
        onValueCommitted: (
          value: RangeValue,
          details: { event?: Event; reason: string }
        ) => {
          dispatch(context, "onRangeCommitted", value, {
            ...details,
            range: name,
          });
        },
        step,
        value: own.value,
        get zoom() {
          return context.store.get().frame.zoom as number | null;
        },
      };
      return controllerFor(name, options, owner);
    },
    rangeProps,
  };
}

const publicOf = (
  state: TimelineState,
  api: TimelineApi,
  props: RangeRef
): RangePublicState => ({
  disabled: api.rangeFor(state, props).getSnapshot().disabled,
  dragging: api.rangeFor(state, props).getSnapshot().dragging,
  fitted: state.view.fitted,
  scrubbing: state.view.scrubbing,
});

const attrsOf = (state: RangePublicState, range: string) => ({
  "data-disabled": flag(state.disabled),
  "data-dragging": flag(state.dragging),
  "data-fitted": flag(state.fitted),
  "data-range": range,
  "data-scrubbing": flag(state.scrubbing),
});

export function rangeSlots(slot: any) {
  /** A drag of `edge` from a part of the range: the press stops here, so the lane underneath takes none. */
  const press =
    (side: "both" | "end" | "start") =>
    (
      event: PointerEvent,
      {
        api,
        el,
        props,
        store,
      }: {
        api: TimelineApi;
        el: HTMLElement | undefined;
        props: RangeRef;
        store: { get: () => TimelineState };
      }
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      const controller = api.rangeFor(store.get(), props);
      const own = api.rangeProps.get(String(props.range));
      const enabled =
        !controller.getSnapshot().disabled &&
        (side !== "both" || (own?.movable ?? true));
      if (!(el && enabled)) {
        return;
      }
      event.preventDefault();
      if (side !== "both") {
        el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
          preventScroll: true,
        });
      }
      controller.press(side, event, el, laneOf(el));
    };

  const edge = (kind: "end" | "start") =>
    slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: RangeRef }
      ) => ({
        ...attrsOf(publicOf(state, api, props), String(props.range)),
        "data-edge": kind,
        style: css({ "touch-action": "none" }),
      }),
      on: { pointerdown: press(kind) },
      props: { range: "key" },
      state: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: RangeRef }
      ) => ({ ...publicOf(state, api, props), edge: kind }),
    });

  const edgeInput = (kind: "end" | "start") =>
    slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: any }
      ) => {
        const controller = api.rangeFor(state, props);
        const view = controller.getSnapshot();
        const current = kind === "start" ? view.value[0] : view.value[1];
        const [min, max] = controller.edgeRange(kind);
        return {
          "aria-valuetext": (props.getAriaValueText ?? describeNumber)(
            current,
            state.duration
          ),
          disabled: flag(view.disabled),
          max: String(max),
          min: String(min),
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(current),
        };
      },
      on: {
        change: (
          event: Event,
          {
            api,
            el,
            props,
            store,
          }: {
            api: TimelineApi;
            el: HTMLElement | undefined;
            props: RangeRef;
            store: { get: () => TimelineState };
          }
        ) =>
          api
            .rangeFor(store.get(), props)
            .edgeTypeAt(kind, Number((el as HTMLInputElement).value), event),
        keydown: (
          event: KeyboardEvent,
          {
            api,
            props,
            store,
          }: {
            api: TimelineApi;
            props: RangeRef;
            store: { get: () => TimelineState };
          }
        ) => {
          if (api.rangeFor(store.get(), props).edgeKeyDown(kind, event)) {
            event.preventDefault();
          }
        },
      },
      props: { getAriaValueText: "value", range: "key" },
    });

  return {
    range: slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: RangeProps }
      ) => {
        const view = api.rangeFor(state, props, true).getSnapshot();
        const [start, end] = view.value;
        const placed = placedOver(start, end - start);
        const minDrawn = props.minDrawnWidth ?? 0;
        return {
          ...attrsOf(
            {
              disabled: view.disabled,
              dragging: view.dragging,
              fitted: state.view.fitted,
              scrubbing: state.view.scrubbing,
            },
            String(props.range)
          ),
          style: css({
            ...placed,
            ...(minDrawn > 0
              ? {
                  width: `max(${placed.width}, calc(${minDrawn}px + ${placed.width} / 2))`,
                }
              : {}),
            "touch-action": "none",
          }),
        };
      },
      // Drawing a new range across empty lane: the press is listened for on the lane itself, which the range does not render.
      bind: (el: HTMLElement, part: any) => {
        const handleDown = (event: PointerEvent) => {
          const given = part.props as RangeProps;
          const controller = part.api.rangeFor(part.store.get(), given, true);
          const lane = event.currentTarget as HTMLElement;
          if (given.drawable && !controller.getSnapshot().disabled) {
            controller.pressDraw(event, lane);
          }
        };
        let lane: HTMLElement | null = null;
        let disposed = false;
        // The lane is looked for once the range is in the document: a framework may bind it before.
        queueMicrotask(() => {
          lane = laneOf(el);
          if (!disposed) {
            lane?.addEventListener("pointerdown", handleDown);
          }
        });
        return () => {
          disposed = true;
          lane?.removeEventListener("pointerdown", handleDown);
        };
      },
      on: { pointerdown: press("both") },
      props: {
        defaultValue: "value",
        disabled: "boolean",
        drawable: "boolean",
        minDrawnWidth: "number",
        minLength: "number",
        movable: "boolean",
        range: "key",
        value: "value",
      },
      state: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: RangeProps }
      ) => ({
        disabled: api.rangeFor(state, props, true).getSnapshot().disabled,
        dragging: api.rangeFor(state, props, true).getSnapshot().dragging,
        fitted: state.view.fitted,
        scrubbing: state.view.scrubbing,
      }),
    }),
    rangeEnd: edge("end"),
    rangeEndInput: edgeInput("end"),
    // The range's own native input: it moves the range from the keyboard and carries its name.
    rangeInput: slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: any }
      ) => {
        const view = api.rangeFor(state, props).getSnapshot();
        const [start, end] = view.value;
        const describe = props.getAriaValueText ?? describeNumber;
        return {
          "aria-valuetext": `${describe(start, state.duration)} to ${describe(end, state.duration)}`,
          disabled: flag(view.disabled),
          max: String(Math.max(0, state.duration - (end - start))),
          min: "0",
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(start),
        };
      },
      on: {
        change: (
          event: Event,
          {
            api,
            el,
            props,
            store,
          }: {
            api: TimelineApi;
            el: HTMLElement | undefined;
            props: RangeRef;
            store: { get: () => TimelineState };
          }
        ) =>
          api
            .rangeFor(store.get(), props)
            .moveTypeAt(Number((el as HTMLInputElement).value), event),
        keydown: (
          event: KeyboardEvent,
          {
            api,
            props,
            store,
          }: {
            api: TimelineApi;
            props: RangeRef;
            store: { get: () => TimelineState };
          }
        ) => {
          if (api.rangeFor(store.get(), props).keyDown(event)) {
            event.preventDefault();
          }
        },
      },
      props: { getAriaValueText: "value", range: "key" },
    }),
    rangeStart: edge("start"),
    rangeStartInput: edgeInput("start"),
  } as RangeSlots;
}