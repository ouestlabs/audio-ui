import {
  css,
  dispatch,
  type PrimitiveContext,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  createChangeEventDetails,
  flag,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../primitive";
import { type ClipValue, clipEnd, type FadeShape, fadeGain } from "./clip";
import {
  type ClipChangeEventDetails,
  type ClipCommitEventDetails,
  type ClipController,
  type ClipTarget,
  createClipController,
} from "./clip-controller";
import { laneOf, placedOver, UNIT_PROPERTY, unitLength } from "./layout";
import type {
  DescribePosition,
  TimelineApi,
  TimelinePublicState,
  TimelineState,
} from "./timeline";

/**
 * The clips of the timeline: a stretch of a source laid on a lane. A clip is
 * named by its `clip` prop and holds a controller of its own; its parts (the
 * header, the trim and fade handles, the fade shades, the inputs) carry the
 * same name, and what they report goes through the Root with the name in the
 * details. Only the clip part itself gives its controller its options.
 */

/** The props every part of a clip takes. */
export interface ClipRef {
  /** The name of the clip it belongs to. */
  clip: string;
  id?: string;
}

/** The props of the clip part: its name, and what it holds. */
export interface ClipProps extends ClipRef {
  /** Whether every press is reported, as one with Shift, Cmd or Ctrl held is. @default false */
  additive?: boolean;
  defaultSelected?: boolean;
  defaultValue?: ClipValue;
  disabled?: boolean;
  /** The shortest the clip can be trimmed to. Defaults to the grid step. */
  minLength?: number;
  /** Whether dragging the header, or the keys, moves the clip. @default true */
  movable?: boolean;
  selected?: boolean;
  /** How long the source is: trimming stops where it runs out. */
  sourceLength?: number;
  value?: ClipValue;
}

export interface ClipPublicState extends TimelinePublicState {
  /** Whether a pointer is moving, trimming or fading the clip. */
  dragging: boolean;
  /** The fade a pointer is dragging, if any. */
  fading: "in" | "out" | undefined;
  selected: boolean;
}

export interface ClipEdgeState extends ClipPublicState {
  /** The edge this part works on. */
  edge: "end" | "in" | "out" | "start";
}

/** What a fade shade draws: the area under the curve and the curve itself, in a 1 by 1 box. */
export interface ClipFadeState extends ClipEdgeState {
  fill: string;
  line: string;
}

/** What the clip's change reports: what moved (`target`), for a move how far and over which lane, whether Alt asks for a copy, the reason, the event, and the clip's name. */
export type ClipChangeDetails = ClipChangeEventDetails & {
  clip: string;
  source?: string;
};

/** What a clip's gesture ending reports. */
export type ClipCommitDetails = ClipCommitEventDetails & { clip: string };

type Slot<Props, Public = ClipPublicState> = SlotDefinition<
  TimelineState,
  TimelineApi,
  Props,
  Public
>;

/** The clip slots, by name. */
export type ClipSlots = {
  clip: Slot<ClipProps>;
  clipFadeIn: Slot<ClipRef, ClipFadeState>;
  clipFadeInHandle: Slot<ClipRef, ClipEdgeState>;
  clipFadeInInput: Slot<
    ClipRef & { getAriaValueText?: DescribePosition },
    object
  >;
  clipFadeOut: Slot<ClipRef, ClipFadeState>;
  clipFadeOutHandle: Slot<ClipRef, ClipEdgeState>;
  clipFadeOutInput: Slot<
    ClipRef & { getAriaValueText?: DescribePosition },
    object
  >;
  clipHeader: Slot<ClipRef>;
  clipInput: Slot<ClipRef & { getAriaValueText?: DescribePosition }, object>;
  clipTrimEnd: Slot<ClipRef, ClipEdgeState>;
  clipTrimEndInput: Slot<
    ClipRef & { getAriaValueText?: DescribePosition },
    object
  >;
  clipTrimStart: Slot<ClipRef, ClipEdgeState>;
  clipTrimStartInput: Slot<
    ClipRef & { getAriaValueText?: DescribePosition },
    object
  >;
};

/** What the timeline's `api` gives the clip parts. */
export interface ClipApi {
  /** The controller of the clip named in `props`; the clip part's own props give it its options. */
  clipFor: (
    state: TimelineState,
    props: ClipProps | ClipRef,
    owner?: boolean
  ) => ClipController;
  /** What each clip was given by its own part. */
  clipProps: Map<string, ClipProps>;
}

const describeNumber = (value: number) => String(Math.round(value * 100) / 100);

const SAMPLES = 16;

/** The points of a fade's curve, in a 1 by 1 box with the gain going up. */
function ramp(shape: FadeShape, edge: "in" | "out") {
  const points: string[] = [];
  for (let index = 0; index <= SAMPLES; index += 1) {
    const x = index / SAMPLES;
    const gain = fadeGain(shape, edge === "in" ? x : 1 - x);
    points.push(`${x} ${1 - gain}`);
  }
  return points;
}

const TARGETS = {
  end: "trim-end",
  in: "fade-in",
  out: "fade-out",
  start: "trim-start",
} as const;

/** The controllers of the clips, and what each was given. */
export function createClipApi(
  context: PrimitiveContext<any, any, any>,
  settings: () => {
    duration: number;
    grid: { offset: number; points?: readonly number[]; step: number };
    largeStep: number;
    step: number;
  },
  bump: () => void
): ClipApi {
  const controllers = new Map<string, ClipController>();
  const clipProps = new Map<string, ClipProps>();
  const provisional = new Set<string>();
  /** The controller of a clip: made once, and again when the clip itself first binds after a part that started it. */
  const controllerFor = (name: string, options: object, owner: boolean) => {
    let controller = controllers.get(name);
    // A part that binds before the clip itself (custom elements make what a clip holds as they connect) starts the controller without what the clip was given: the clip starts it again, with it.
    if (controller && owner && provisional.has(name)) {
      provisional.delete(name);
      controller = undefined;
      // The parts that read the early one read this one now.
      queueMicrotask(bump);
    }
    if (controller) {
      if (owner) {
        controller.setOptions(options as never);
      }
    } else {
      controller = createClipController(options as never);
      controller.subscribe(bump);
      controllers.set(name, controller);
      if (!owner) {
        provisional.add(name);
      }
    }
    return controller;
  };
  return {
    clipFor: (state, props, owner = false) => {
      const name = String(props.clip);
      const own = props as ClipProps;
      const { duration, grid, largeStep, step } = settings();
      if (owner) {
        clipProps.set(name, own);
      }
      const options = {
        additive: own.additive ?? false,
        defaultSelected: own.defaultSelected ?? false,
        defaultValue: own.defaultValue,
        disabled: state.view.disabled || Boolean(own.disabled),
        duration,
        grid,
        largeStep,
        minLength: own.minLength ?? (grid.step > 0 ? grid.step : step),
        movable: own.movable ?? true,
        onDragOffsetChange: (offset: number) => {
          dispatch(context, "onClipDragOffsetChange", offset, {
            clip: name,
            reason: "drag",
          });
        },
        onRemove: (event: KeyboardEvent) => {
          dispatch(context, "onClipRemove", name, {
            clip: name,
            event,
            reason: createChangeEventDetails("keyboard", event).reason,
          });
        },
        onSelectedChange: (
          selected: boolean,
          details: { event: PointerEvent; reason: string }
        ) => {
          dispatch(context, "onClipSelectedChange", selected, {
            clip: name,
            event: details.event,
            reason: details.reason,
          });
        },
        onValueChange: (
          value: ClipValue,
          details: {
            cancel: () => void;
            event?: Event;
            reason: string;
          }
        ) => {
          const { cancel, ...rest } = details;
          const source = sourceOf(details.event);
          if (
            dispatch(context, "onClipChange", value, {
              ...rest,
              clip: name,
              ...(source ? { source } : {}),
            })
          ) {
            cancel();
          }
        },
        onValueCommitted: (
          value: ClipValue,
          details: { event?: Event; reason: string }
        ) => {
          dispatch(context, "onClipCommitted", value, {
            ...details,
            clip: name,
          });
        },
        selected: own.selected,
        sourceLength: own.sourceLength,
        step,
        value: own.value,
        // Read when a gesture needs it: a clip is not drawn again at each step of a zoom.
        get zoom() {
          return context.store.get().frame.zoom as number | null;
        },
      };
      return controllerFor(name, options, owner);
    },
    clipProps,
  };
}

/** Which fade a drag is on, if any. */
function fadingOf(target: string | null | undefined): "in" | "out" | undefined {
  if (target === "fade-in") {
    return "in";
  }
  return target === "fade-out" ? "out" : undefined;
}

/** What a clip part reads of its clip. */
function stateOf(
  state: TimelineState,
  api: TimelineApi,
  props: ClipRef
): ClipPublicState {
  const view = api.clipFor(state, props).getSnapshot();
  const fading = fadingOf(view.dragTarget);
  return {
    disabled: view.disabled,
    dragging: view.dragging,
    fading,
    fitted: state.view.fitted,
    scrubbing: state.view.scrubbing,
    selected: view.selected,
  };
}

const attrsOf = (state: ClipPublicState, clip: string) => ({
  "data-clip": clip,
  "data-disabled": flag(state.disabled),
  "data-dragging": flag(state.dragging),
  "data-fading": state.fading,
  "data-fitted": flag(state.fitted),
  "data-selected": flag(state.selected),
});

/** The slots of the clip and its parts. */
export function clipSlots(slot: any) {
  const focusInput = (el: HTMLElement | undefined) =>
    el
      ?.querySelector<HTMLInputElement>('input[type="range"]')
      ?.focus({ preventScroll: true });

  /** A drag of `target` from a part of the clip: the press stops here, so the lane underneath takes none. */
  const press =
    (target: ClipTarget, focus: "clip" | "own") =>
    (
      event: PointerEvent,
      context: {
        api: TimelineApi;
        el: HTMLElement | undefined;
        props: ClipRef;
        store: { get: () => TimelineState };
      }
    ) => {
      const { api, el, props, store } = context;
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      const controller = api.clipFor(store.get(), props);
      const own = api.clipProps.get(String(props.clip));
      const { disabled } = controller.getSnapshot();
      const enabled =
        !disabled && (target !== "move" || (own?.movable ?? true));
      if (!(el && enabled)) {
        return;
      }
      event.preventDefault();
      if (focus === "own") {
        focusInput(el);
      } else {
        focusInput(
          el.closest<HTMLElement>('[data-slot="timeline-clip"]') ?? el
        );
      }
      controller.press(target, event, el, laneOf(el));
    };

  /** A native input of the clip that works on `edge`. */
  const edgeInput = (edge: "end" | "in" | "out" | "start") => {
    const target = TARGETS[edge];
    return slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: any }
      ) => {
        const controller = api.clipFor(state, props);
        const view = controller.getSnapshot();
        const { value } = view;
        const describe = props.getAriaValueText ?? describeNumber;
        const current = {
          end: clipEnd(value),
          in: value.fadeIn,
          out: value.fadeOut,
          start: value.start,
        }[edge];
        const [min, max] =
          edge === "in" || edge === "out"
            ? [
                0,
                Math.max(
                  0,
                  value.length - (edge === "in" ? value.fadeOut : value.fadeIn)
                ),
              ]
            : controller.edgeRange(target);
        return {
          "aria-valuetext": describe(current, state.duration),
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
            props: ClipRef;
            store: { get: () => TimelineState };
          }
        ) =>
          api
            .clipFor(store.get(), props)
            .edgeTypeAt(target, Number((el as HTMLInputElement).value), event),
        keydown: (
          event: KeyboardEvent,
          {
            api,
            props,
            store,
          }: {
            api: TimelineApi;
            props: ClipRef;
            store: { get: () => TimelineState };
          }
        ) => {
          const controller = api.clipFor(store.get(), props);
          if (controller.getSnapshot().disabled) {
            return;
          }
          if ((edge === "in" || edge === "out") && event.key === "Enter") {
            // Enter steps the shape, as it does on the handle's double click.
            event.preventDefault();
            controller.cycleFadeShape(edge, "keyboard", event);
            return;
          }
          if (controller.edgeKeyDown(target, event)) {
            event.preventDefault();
            // Delete took the fade away: it is not for the clip, or the page, to remove anything too.
            if (
              (edge === "in" || edge === "out") &&
              (event.key === "Delete" || event.key === "Backspace")
            ) {
              event.stopPropagation();
            }
          }
        },
      },
      props: { clip: "key", getAriaValueText: "value" },
    });
  };

  /** A handle that trims or fades an edge by dragging. */
  const edgeHandle = (edge: "end" | "in" | "out" | "start") => {
    const fade = edge === "in" || edge === "out";
    return slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipRef }
      ) => {
        const view = stateOf(state, api, props);
        let place = {};
        if (fade) {
          place =
            edge === "in"
              ? {
                  "inset-inline-start":
                    "calc(var(--clip-unit) * var(--clip-fade-in))",
                }
              : {
                  "inset-inline-end":
                    "calc(var(--clip-unit) * var(--clip-fade-out))",
                };
        }
        return {
          ...attrsOf(view, String(props.clip)),
          "data-edge": edge,
          style: css({
            ...place,
            ...(fade ? { position: "absolute" } : {}),
            "touch-action": "none",
          }),
        };
      },
      on: {
        dblclick: (
          event: MouseEvent,
          {
            api,
            props,
            store,
          }: {
            api: TimelineApi;
            props: ClipRef;
            store: { get: () => TimelineState };
          }
        ) => {
          const controller = api.clipFor(store.get(), props);
          if (fade && !controller.getSnapshot().disabled) {
            controller.cycleFadeShape(edge, "double-click", event);
          }
        },
        pointerdown: press(TARGETS[edge], "own"),
      },
      props: { clip: "key" },
      state: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipRef }
      ) => ({ ...stateOf(state, api, props), edge }),
    });
  };

  /** The shade of a fade: its curve, in a 1 by 1 box. */
  const fadeShade = (edge: "in" | "out") =>
    slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipRef }
      ) => {
        const view = api.clipFor(state, props).getSnapshot();
        const length = edge === "in" ? view.value.fadeIn : view.value.fadeOut;
        const property = edge === "in" ? "--clip-fade-in" : "--clip-fade-out";
        return {
          ...attrsOf(stateOf(state, api, props), String(props.clip)),
          "aria-hidden": "true",
          // What a framework that cannot draw from the state draws the curve from.
          "data-edge-in": edge === "in" ? "" : undefined,
          "data-shape":
            (edge === "in"
              ? view.value.fadeInShape
              : view.value.fadeOutShape) ?? "linear",
          focusable: "false",
          preserveAspectRatio: "none",
          style: css({
            // A positioned svg does not stretch between top and bottom without a height. `--clip-fade-top` leaves room above it, from a class: a style given to the part replaces this one.
            display: length > 0 ? undefined : "none",
            height: "calc(100% - var(--clip-fade-top, 0px))",
            "pointer-events": "none",
            position: "absolute",
            top: "var(--clip-fade-top, 0px)",
            width: `calc(var(--clip-unit) * var(${property}))`,
            ...(edge === "in"
              ? { "inset-inline-start": "0" }
              : { "inset-inline-end": "0" }),
          }),
          viewBox: "0 0 1 1",
        };
      },
      props: { clip: "key" },
      state: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipRef }
      ) => {
        const { value } = api.clipFor(state, props).getSnapshot();
        const shape =
          (edge === "in" ? value.fadeInShape : value.fadeOutShape) ?? "linear";
        const points = ramp(shape, edge);
        return {
          ...stateOf(state, api, props),
          edge,
          fill: `M0 0H1L${[...points].reverse().join("L")}Z`,
          line: `M${points.join("L")}`,
        };
      },
    });

  return {
    clip: slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipProps }
      ) => {
        const view = api.clipFor(state, props, true).getSnapshot();
        const { value } = view;
        const { fadeIn, fadeOut, length, offset, start } = value;
        const fading = fadingOf(view.dragTarget);
        return {
          ...attrsOf(
            {
              disabled: view.disabled,
              dragging: view.dragging,
              fading,
              fitted: state.view.fitted,
              scrubbing: state.view.scrubbing,
              selected: view.selected,
            },
            String(props.clip)
          ),
          style: css({
            ...placedOver(start, length),
            "--clip-drag-y": `${view.dragOffset}px`,
            "--clip-fade-in": String(fadeIn),
            // How long each fade can grow: up to where the other one begins.
            "--clip-fade-in-max": String(length - fadeOut),
            "--clip-fade-out": String(fadeOut),
            "--clip-fade-out-max": String(length - fadeIn),
            "--clip-offset": String(offset),
            // A unit inside the clip: fitted, the timeline's unit is a share of the lane, which inside the clip would be a share of the clip.
            "--clip-unit": state.view.fitted
              ? unitLength(null, length)
              : `var(${UNIT_PROPERTY})`,
            ...(props.sourceLength === undefined
              ? {}
              : { "--clip-source-length": String(props.sourceLength) }),
            "touch-action": "none",
            transform: view.dragging
              ? "translateY(var(--clip-drag-y))"
              : undefined,
          }),
        };
      },
      on: {
        // A press on the body selects the clip and puts the cursor there, and a drag scrubs it: the header moves the clip.
        pointerdown: (
          event: PointerEvent,
          {
            api,
            el,
            props,
            store,
          }: {
            api: TimelineApi;
            el: HTMLElement | undefined;
            props: ClipProps;
            store: { get: () => TimelineState };
          }
        ) => {
          const state = store.get();
          const controller = api.clipFor(state, props, true);
          if (
            !el ||
            controller.getSnapshot().disabled ||
            state.view.disabled ||
            event.button !== 0
          ) {
            return;
          }
          controller.select(event);
          const lane = laneOf(el);
          if (lane) {
            api.controller.pressSeek(event, el, lane);
          }
          focusInput(el);
        },
      },
      props: {
        additive: "boolean",
        clip: "key",
        defaultSelected: "boolean",
        defaultValue: "value",
        disabled: "boolean",
        minLength: "number",
        movable: "boolean",
        selected: "boolean",
        sourceLength: "number",
        value: "value",
      },
      state: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipProps }
      ) => ({ ...stateOf(state, api, props) }),
    }),
    clipFadeIn: fadeShade("in"),
    clipFadeInHandle: edgeHandle("in"),
    clipFadeInInput: edgeInput("in"),
    clipFadeOut: fadeShade("out"),
    clipFadeOutHandle: edgeHandle("out"),
    clipFadeOutInput: edgeInput("out"),
    // The strip of the clip that moves it by dragging.
    clipHeader: slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipRef }
      ) => ({
        ...attrsOf(stateOf(state, api, props), String(props.clip)),
        style: css({ "touch-action": "none" }),
      }),
      on: { pointerdown: press("move", "clip") },
      props: { clip: "key" },
      state: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: ClipRef }
      ) => stateOf(state, api, props),
    }),
    // The clip's own native input: it moves the clip from the keyboard and carries its name.
    clipInput: slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: any }
      ) => {
        const controller = api.clipFor(state, props);
        const view = controller.getSnapshot();
        const { value } = view;
        const describe = props.getAriaValueText ?? describeNumber;
        return {
          "aria-valuetext": `${describe(value.start, state.duration)} to ${describe(value.start + value.length, state.duration)}`,
          disabled: flag(view.disabled),
          max: String(Math.max(0, state.duration - value.length)),
          min: "0",
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(value.start),
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
            props: ClipRef;
            store: { get: () => TimelineState };
          }
        ) =>
          api
            .clipFor(store.get(), props)
            .moveTypeAt(Number((el as HTMLInputElement).value), event),
        keydown: (
          event: KeyboardEvent,
          {
            api,
            props,
            store,
          }: {
            api: TimelineApi;
            props: ClipRef;
            store: { get: () => TimelineState };
          }
        ) => {
          if (api.clipFor(store.get(), props).keyDown(event)) {
            event.preventDefault();
          }
        },
      },
      props: { clip: "key", getAriaValueText: "value" },
    }),
    clipTrimEnd: edgeHandle("end"),
    clipTrimEndInput: edgeInput("end"),
    clipTrimStart: edgeHandle("start"),
    clipTrimStartInput: edgeInput("start"),
  } as ClipSlots;
}