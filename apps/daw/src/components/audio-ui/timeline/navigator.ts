import { css, type SlotDefinition } from "@ui-sdk/core";
import { flag, VISUALLY_HIDDEN } from "../primitive";
import {
  createNavigatorController,
  type NavigatorController,
  type NavigatorPart,
  thumbOf,
  visibleRange,
} from "./navigator-controller";
import type {
  DescribePosition,
  TimelineApi,
  TimelinePublicState,
  TimelineState,
} from "./timeline";

/**
 * The navigator: a bar with the stretch the viewport shows inside it, which a
 * drag or a key moves. A move of the window scrolls, a move of an edge zooms
 * and holds the other edge still. Its parts follow the viewport straight in
 * the DOM, so a scroll never renders.
 */

/** The props of the navigator part. */
export interface NavigatorProps {
  id?: string;
  /** The least width the window is drawn at, in px. @default 0 */
  minWindowWidth?: number;
}

interface PartProps {
  id?: string;
}

export interface NavigatorEdgeState extends TimelinePublicState {
  edge: "end" | "start";
}

type Slot<Props, Public = TimelinePublicState> = SlotDefinition<
  TimelineState,
  TimelineApi,
  Props,
  Public
>;

type InputSlot = Slot<
  PartProps & { getAriaValueText?: DescribePosition },
  object
>;

/** The navigator slots, by name. */
export type NavigatorSlots = {
  navigator: Slot<NavigatorProps>;
  navigatorEnd: Slot<PartProps, NavigatorEdgeState>;
  navigatorEndInput: InputSlot;
  navigatorStart: Slot<PartProps, NavigatorEdgeState>;
  navigatorStartInput: InputSlot;
  navigatorWindow: Slot<PartProps>;
  navigatorWindowInput: InputSlot;
};

/** What the navigator's `api` gives its parts. */
export interface NavigatorApi {
  /** The bar, and what it was given, once the navigator part binds. */
  navigator: {
    el: HTMLElement | null;
    minWindowWidth: number;
    /** The bar's width, measured when it binds and when it is resized: reading it from the DOM at each paint would lay the page out each time. */
    width: number;
  };
  /** A controller over the viewport as it is now. */
  navigatorFor: (state: TimelineState) => NavigatorController;
}

const describeNumber = (value: number) => String(Math.round(value * 100) / 100);

export function createNavigatorApi(
  api: () => TimelineApi,
  /** How close the timeline zooms, in px per unit: where the window stops narrowing. */
  maxZoom: () => number
): NavigatorApi {
  const navigator = {
    el: null as HTMLElement | null,
    minWindowWidth: 0,
    width: 0,
  };
  return {
    navigator,
    navigatorFor: (state) =>
      createNavigatorController({
        disabled: state.view.disabled,
        duration: state.duration,
        maxZoom: maxZoom(),
        metrics: () => api().viewport.get(),
        minWindowWidth: navigator.minWindowWidth,
        scrollTo: (left) => api().scrollerTo.current?.(left),
        zoomTo: (next, details, anchor) => api().zoomTo(next, details, anchor),
      }),
  };
}

/** Where the window sits in the bar, as shares of it, and the stretch it shows. */
function layoutOf(api: TimelineApi, state: TimelineState) {
  const { duration } = state;
  const range = visibleRange(api.viewport.get(), duration);
  const bar = api.navigator.width;
  const { minWindowWidth } = api.navigator;
  const drawn =
    minWindowWidth > 0 && bar > 0 && duration > 0
      ? thumbOf(range, duration, bar, minWindowWidth)
      : null;
  const span = drawn ? bar : Math.max(duration, Number.MIN_VALUE);
  const [from, to] = drawn ?? range;
  return {
    duration,
    range,
    thumb: { end: to / span, start: from / span, width: (to - from) / span },
  };
}

const percent = (share: number) => `${share * 100}%`;

const publicOf = (state: TimelineState): TimelinePublicState => ({
  disabled: state.view.disabled,
  fitted: state.view.fitted,
  scrubbing: state.view.scrubbing,
});

const attrsOf = (state: TimelineState) => ({
  "data-disabled": flag(state.view.disabled),
  "data-fitted": flag(state.view.fitted),
  "data-scrubbing": flag(state.view.scrubbing),
});

/** Runs `write` now and on each change of the viewport, outside any render. */
function follow(
  part: { api: TimelineApi; store: { get: () => TimelineState } },
  write: (layout: ReturnType<typeof layoutOf>) => void
) {
  const run = () => write(layoutOf(part.api, part.store.get()));
  run();
  return part.api.viewport.subscribe(run);
}

export function navigatorSlots(slot: any) {
  const press =
    (kind: NavigatorPart) =>
    (
      event: PointerEvent,
      {
        api,
        el,
        store,
      }: {
        api: TimelineApi;
        el: HTMLElement | undefined;
        store: { get: () => TimelineState };
      }
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      const state = store.get();
      if (!el || state.view.disabled) {
        return;
      }
      event.preventDefault();
      api.navigatorFor(state).press(kind, event, el, api.navigator.el);
    };

  const edge = (kind: "end" | "start") =>
    slot({
      attrs: (state: TimelineState, { api }: { api: TimelineApi }) => {
        const { thumb } = layoutOf(api, state);
        return {
          ...attrsOf(state),
          "data-edge": kind,
          style: css({
            left: percent(kind === "start" ? thumb.start : thumb.end),
            position: "absolute",
            "touch-action": "none",
          }),
        };
      },
      bind: (el: HTMLElement, part: any) =>
        follow(part, ({ thumb }) => {
          el.style.left = percent(kind === "start" ? thumb.start : thumb.end);
        }),
      on: { pointerdown: press(kind) },
      state: (state: TimelineState) => ({ ...publicOf(state), edge: kind }),
    });

  const edgeInput = (kind: "end" | "start") =>
    slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: any }
      ) => {
        const { duration, range } = layoutOf(api, state);
        const current = kind === "start" ? range[0] : range[1];
        return {
          "aria-valuetext": (props.getAriaValueText ?? describeNumber)(
            current,
            duration
          ),
          disabled: flag(state.view.disabled),
          max: String(kind === "start" ? range[1] : duration),
          min: String(kind === "start" ? 0 : range[0]),
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(current),
        };
      },
      bind: (el: HTMLElement, part: any) =>
        follow(part, ({ duration, range }) => {
          const input = el as HTMLInputElement;
          const current = kind === "start" ? range[0] : range[1];
          input.max = String(kind === "start" ? range[1] : duration);
          input.min = String(kind === "start" ? 0 : range[0]);
          input.value = String(current);
          input.setAttribute(
            "aria-valuetext",
            (part.props.getAriaValueText ?? describeNumber)(current, duration)
          );
        }),
      on: {
        change: (
          event: Event,
          {
            api,
            el,
            store,
          }: {
            api: TimelineApi;
            el: HTMLElement | undefined;
            store: { get: () => TimelineState };
          }
        ) =>
          api
            .navigatorFor(store.get())
            .typeAt(kind, Number((el as HTMLInputElement).value), event),
        keydown: (
          event: KeyboardEvent,
          {
            api,
            store,
          }: { api: TimelineApi; store: { get: () => TimelineState } }
        ) => {
          if (api.navigatorFor(store.get()).keyDown(kind, event)) {
            event.preventDefault();
          }
        },
      },
      props: { getAriaValueText: "value" },
    });

  return {
    navigator: slot({
      attrs: (state: TimelineState) => ({
        ...attrsOf(state),
        style: css({ position: "relative", "touch-action": "none" }),
      }),
      bind: (el: HTMLElement, part: any) => {
        const { navigator } = part.api;
        navigator.el = el;
        navigator.minWindowWidth = part.props.minWindowWidth ?? 0;
        navigator.width = el.getBoundingClientRect().width;
        // The parts read the width again when the bar is resized.
        const observer = new ResizeObserver(() => {
          const { width } = el.getBoundingClientRect();
          if (width !== navigator.width) {
            navigator.width = width;
            part.store.set({ parts: part.store.get().parts + 1 });
          }
        });
        observer.observe(el);
        return () => {
          observer.disconnect();
          navigator.el = null;
        };
      },
      on: {
        dblclick: (
          event: MouseEvent,
          {
            api,
            store,
          }: { api: TimelineApi; store: { get: () => TimelineState } }
        ) => api.navigatorFor(store.get()).doubleClick(event),
      },
      props: { minWindowWidth: "number" },
      state: (state: TimelineState) => publicOf(state),
    }),
    navigatorEnd: edge("end"),
    navigatorEndInput: edgeInput("end"),
    navigatorStart: edge("start"),
    navigatorStartInput: edgeInput("start"),
    navigatorWindow: slot({
      attrs: (state: TimelineState, { api }: { api: TimelineApi }) => {
        const { thumb } = layoutOf(api, state);
        return {
          ...attrsOf(state),
          style: css({
            left: percent(thumb.start),
            position: "absolute",
            width: percent(thumb.width),
          }),
        };
      },
      bind: (el: HTMLElement, part: any) =>
        follow(part, ({ thumb }) => {
          el.style.left = percent(thumb.start);
          el.style.width = percent(thumb.width);
        }),
      on: { pointerdown: press("window") },
      state: (state: TimelineState) => publicOf(state),
    }),
    navigatorWindowInput: slot({
      attrs: (
        state: TimelineState,
        { api, props }: { api: TimelineApi; props: any }
      ) => {
        const { duration, range } = layoutOf(api, state);
        const describe = props.getAriaValueText ?? describeNumber;
        return {
          "aria-valuetext": `${describe(range[0], duration)} to ${describe(range[1], duration)}`,
          disabled: flag(state.view.disabled),
          max: String(Math.max(0, duration - (range[1] - range[0]))),
          min: "0",
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(range[0]),
        };
      },
      bind: (el: HTMLElement, part: any) =>
        follow(part, ({ duration, range }) => {
          const input = el as HTMLInputElement;
          const describe = part.props.getAriaValueText ?? describeNumber;
          input.max = String(Math.max(0, duration - (range[1] - range[0])));
          input.value = String(range[0]);
          input.setAttribute(
            "aria-valuetext",
            `${describe(range[0], duration)} to ${describe(range[1], duration)}`
          );
        }),
      on: {
        change: (
          event: Event,
          {
            api,
            el,
            store,
          }: {
            api: TimelineApi;
            el: HTMLElement | undefined;
            store: { get: () => TimelineState };
          }
        ) =>
          api
            .navigatorFor(store.get())
            .typeAt("window", Number((el as HTMLInputElement).value), event),
        keydown: (
          event: KeyboardEvent,
          {
            api,
            store,
          }: { api: TimelineApi; store: { get: () => TimelineState } }
        ) => {
          if (api.navigatorFor(store.get()).keyDown("window", event)) {
            event.preventDefault();
          }
        },
      },
      props: { getAriaValueText: "value" },
    }),
  } as NavigatorSlots;
}