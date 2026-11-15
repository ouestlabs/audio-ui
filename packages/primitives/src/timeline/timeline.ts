import {
  clampFinite,
  createStore,
  type Source,
  type Store,
} from "@audio-ui/core";
import {
  anchoredScroll,
  createRangeController,
  createTimelineController,
  createTrackController,
  createWheelZoom,
  type Grid,
  type RangeController,
  type TimelineController,
  type TimelineSnapshot,
  type TrackController,
  valueAtOffset,
  type ZoomAnchor,
} from "@audio-ui/core/timeline";
import {
  createChange,
  css,
  definePrimitive,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  type ChangeDetails,
  type CommitDetails,
  flag,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../shared.ts";

/**
 * The timeline as a UI SDK primitive, over the controllers of
 * `@audio-ui/core/timeline`: the position and the zoom, a track's height, a
 * mark's drag. The primitive routes the elements' events to them and reports
 * what they change through the kernel.
 *
 * Everything that moves every frame reaches the DOM outside any render: the
 * playhead follows the position through a CSS variable, a lane is sized by its
 * unit, and the viewport measures and scrolls itself.
 *
 * Parts that hold a controller of their own (a track, a mark) are named by a
 * prop and report through the Root, with their name in the details.
 */

/** Set on every lane: the width of one unit of time, so parts place themselves with `calc()`. */
export const UNIT_PROPERTY = "--timeline-unit";
/** Set on every placed part: where it sits, in units. */
export const OFFSET_PROPERTY = "--timeline-offset";
/** Set on every part that spans a stretch of the lane: how long it is, in units. */
export const LENGTH_PROPERTY = "--timeline-length";

const describeAsNumber = (value: number) =>
  String(Math.round(value * 100) / 100);

export type DescribePosition = (value: number, duration: number) => string;

/** A live position, in the timeline's units. */
export type PositionSource = Source<number>;

/** How the viewport is scrolled and zoomed, as last laid out. */
export interface ViewportMetrics {
  /** Where value 0 sits in the scrolled content, in px. */
  origin: number;
  scrollStart: number;
  /** Visible width, in px. */
  width: number;
  /** px per unit as drawn: the zoom, or what fitting the width gives. */
  zoom: number;
}

export interface TimelinePrimitiveOptions {
  defaultPosition?: number;
  defaultZoom?: number | null;
  disabled?: boolean;
  /** Length of the timeline, in your units. @default 1 */
  duration?: number;
  largeStep?: number;
  /** @default Infinity */
  maxZoom?: number;
  /** @default 0 */
  minZoom?: number;
  onMarkChange?: (value: number, details: MarkChangeDetails) => void;
  onMarkCommitted?: (value: number, details: MarkCommitDetails) => void;
  onPositionChange?: (value: number, details: ChangeDetails) => void;
  onPositionCommitted?: (value: number, details: CommitDetails) => void;
  /** A Shift drag on the ruler, or on a seekable lane, selected a stretch. */
  onSelectionChange?: (
    range: readonly [number, number],
    details: ChangeDetails
  ) => void;
  onSelectionCommitted?: (
    range: readonly [number, number],
    details: CommitDetails
  ) => void;
  onTrackHeightChange?: (
    height: number | undefined,
    details: TrackChangeDetails
  ) => void;
  onTrackHeightCommitted?: (
    height: number | undefined,
    details: TrackCommitDetails
  ) => void;
  onZoomChange?: (zoom: number, details: ChangeDetails) => void;
  position?: number;
  snapOffset?: number;
  snapPoints?: readonly number[];
  snapStep?: number;
  source?: PositionSource;
  step?: number;
  zoom?: number | null;
}

export interface MarkChangeDetails extends ChangeDetails {
  mark: string;
}
export interface MarkCommitDetails extends CommitDetails {
  mark: string;
}
export interface TrackChangeDetails extends ChangeDetails {
  track: string;
}
export interface TrackCommitDetails extends CommitDetails {
  track: string;
}

export interface TimelineState {
  duration: number;
  /** Counts the changes a track's or mark's controller made, so the parts read them again. */
  parts: number;
  position: number;
  /** The live position the timeline follows, when it has one. */
  source: PositionSource | undefined;
  view: TimelineSnapshot;
  zoom: number | null;
}

/** What a part reads of the timeline. */
export interface TimelinePublicState {
  disabled: boolean;
  /** Whether no zoom is set, so the timeline fits the width it is given. */
  fitted: boolean;
  /** Whether a pointer is moving the position. */
  scrubbing: boolean;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a track's parts. */
export interface TrackProps extends PartProps {
  height?: number;
  largeStep?: number;
  maxHeight?: number;
  minHeight?: number;
  selected?: boolean;
  step?: number;
  /** The name of the track: what keys it and what its changes report. */
  track: string;
}

export interface TrackPublicState extends TimelinePublicState {
  resizing: boolean;
  selected: boolean;
}

/** The props of the parts that belong to a track, beside the track itself. */
export interface TrackRef extends PartProps {
  /** The name of the track it belongs to. */
  track: string;
}

/** The props of a mark. */
export interface MarkProps extends PartProps {
  /** The name of the mark: what keys it and what its changes report. */
  mark: string;
  /** Whether a drag, or the arrows, move it. @default false */
  movable?: boolean;
  step?: number;
  value: number;
}

export interface MarkPublicState extends TimelinePublicState {
  dragging: boolean;
}

/** What a timeline's `api` gives an adapter. */
export interface TimelineApi {
  /** Where the next zoom should hold still; the viewport applies it once laid out. */
  anchor: { current: ZoomAnchor | null };
  controller: TimelineController;
  internal: { keyOf: (value: unknown) => string };
  /** The lanes mounted: the first in the document is where value 0 is measured from. */
  lanes: Set<HTMLElement>;
  markFor: (state: TimelineState, props: MarkProps) => RangeController;
  /** Where each mark's press began, so a press that stays one still clicks. */
  markPress: Map<string, { moved: boolean; x: number }>;
  /** The position, observable outside any render. */
  position: Store<number>;
  /** Scrolls the viewport to `left` px and reports where it landed. */
  scrollerTo: { current: ((left: number) => void) | null };
  trackFor: (
    state: TimelineState,
    props: TrackProps,
    /** Whether `props` are the track part's own, which hold what the track is given. */
    owner?: boolean
  ) => TrackController;
  /** What each track was given by its own part. */
  trackProps: Map<string, TrackProps>;
  /** The element of a part, by its name, once it binds. */
  tracks: Map<string, HTMLElement>;
  viewport: Store<ViewportMetrics>;
  viewportEl: { current: HTMLElement | null };
  /** px per unit, or null while fitted: read when needed, or followed. */
  zoom: { get: () => number | null; subscribe: (l: () => void) => () => void };
  zoomTo: (
    next: number,
    details: Parameters<TimelineController["zoomTo"]>[1],
    anchor?: ZoomAnchor
  ) => boolean;
}

type Slot<Props, Public = TimelinePublicState> = SlotDefinition<
  TimelineState,
  TimelineApi,
  Props,
  Public
>;

/** The timeline's slots, by name, with the props and the public state of each. */
export type TimelineSlots = {
  lane: Slot<PartProps & { seekable?: boolean }>;
  mark: Slot<MarkProps, MarkPublicState>;
  playhead: Slot<PartProps>;
  root: Slot<PartProps>;
  ruler: Slot<PartProps>;
  rulerInput: Slot<PartProps & { getAriaValueText?: DescribePosition }, object>;
  track: Slot<TrackProps, TrackPublicState>;
  trackHeader: Slot<PartProps, TrackPublicState>;
  trackResizeHandle: Slot<TrackRef, TrackPublicState>;
  trackResizeInput: Slot<TrackRef, object>;
  viewport: Slot<PartProps>;
};

/** The type of `timeline`, written out so a declaration can print it. */
export interface TimelinePrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: TimelineSlots;
  (
    initialOptions: TimelinePrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: TimelineApi;
    get: () => TimelineState;
    types: {
      api: TimelineApi;
      options: TimelinePrimitiveOptions;
      slots: TimelineSlots;
      state: TimelineState;
    };
  };
}

/** The options the controller needs, with the defaults the React timeline gave. */
function adjustOptions(options: TimelinePrimitiveOptions) {
  const duration = options.duration ?? 1;
  const snapStep = options.snapStep ?? 0;
  const step = options.step ?? (snapStep > 0 ? snapStep : duration / 100);
  const grid: Grid = {
    offset: options.snapOffset ?? 0,
    points: options.snapPoints,
    step: snapStep,
  };
  return {
    defaultPosition: options.defaultPosition ?? 0,
    defaultZoom: options.defaultZoom ?? null,
    disabled: options.disabled ?? false,
    duration,
    grid,
    largeStep: options.largeStep ?? step * 10,
    maxZoom: options.maxZoom ?? Number.POSITIVE_INFINITY,
    minZoom: options.minZoom ?? 0,
    source: options.source,
    step,
  };
}

function viewOf(options: TimelinePrimitiveOptions): TimelineSnapshot {
  return createTimelineController({
    ...adjustOptions(options),
    position: options.position,
    zoom: options.zoom,
  }).getSnapshot();
}

const publicState = (state: TimelineState): TimelinePublicState => ({
  disabled: state.view.disabled,
  fitted: state.view.fitted,
  scrubbing: state.view.scrubbing,
});

const stateAttrs = (state: TimelineState) => ({
  "data-disabled": flag(state.view.disabled),
  "data-fitted": flag(state.view.fitted),
  "data-scrubbing": flag(state.view.scrubbing),
});

/** The width of one unit: px when zoomed, a share of the lane when fitted. */
const unitLength = (zoom: number | null, duration: number) =>
  zoom === null ? `calc(100% / ${duration > 0 ? duration : 1})` : `${zoom}px`;

/** Places a part at its `--timeline-offset` along the lane. */
const placedAt = (value: number) => ({
  [OFFSET_PROPERTY]: String(value),
  left: `calc(var(${UNIT_PROPERTY}) * var(${OFFSET_PROPERTY}))`,
  position: "absolute",
});

/**
 * How much the transforms of the element's ancestors scale it, such as a
 * dialog that zooms in: what `getBoundingClientRect` gives is divided by it to
 * get back to layout px, which `scrollLeft` and `clientWidth` are in.
 */
function layoutScale(element: HTMLElement) {
  const drawn = element.getBoundingClientRect().width;
  const laid = element.offsetWidth;
  return drawn > 0 && laid > 0 ? drawn / laid : 1;
}

/** The first lane in the document. */
const originLane = (lanes: Set<HTMLElement>) =>
  [...lanes].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  )[0] ?? null;

/** The lane an element sits in. */
const laneOf = (el: Element | null) =>
  el?.closest<HTMLElement>("[data-timeline-lane]") ?? null;

const PRESS_SLOP_PX = 3;

const inField = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const timeline: TimelinePrimitive = definePrimitive({
  agent: { actions: ["setPosition"] },
  api: (context) => {
    const options = () => context.options() as TimelinePrimitiveOptions;
    const controller: TimelineController = createTimelineController({
      ...adjustOptions(options()),
      position: options().position,
      zoom: options().zoom,
    });
    const change = createChange(context);

    // The controller always works controlled: the kernel holds the position and the zoom.
    const configure = () => {
      const wanted = options();
      const held = context.store.get();
      controller.setOptions({
        ...adjustOptions(wanted),
        onPositionChange: (value, details) => {
          const source = sourceOf(details.event);
          if (
            !change("position", value, {
              event: details.event,
              reason: details.reason,
              ...(source ? { source } : {}),
            } as never)
          ) {
            details.cancel();
          }
        },
        onPositionCommitted: (value, details) => {
          dispatch(context, "onPositionCommitted", value, {
            event: details.event,
            reason: details.reason,
          });
        },
        onZoomChange: (zoom, details) => {
          const source = sourceOf(details.event);
          if (
            !change("zoom", zoom, {
              event: details.event,
              reason: details.reason,
              ...(source ? { source } : {}),
            } as never)
          ) {
            details.cancel();
          }
        },
        position: held.position,
        zoom: held.zoom,
      });
      context.store.set({ view: controller.getSnapshot() } as never);
    };
    configure();
    context.onOptions(configure);
    let lastPosition = context.store.get().position;
    let lastZoom = context.store.get().zoom;
    context.onDestroy(
      context.store.subscribe(() => {
        const { position, zoom } = context.store.get();
        if (position !== lastPosition || zoom !== lastZoom) {
          lastPosition = position;
          lastZoom = zoom;
          configure();
        }
      })
    );
    context.onDestroy(
      controller.subscribe(() =>
        context.store.set({ view: controller.getSnapshot() } as never)
      )
    );

    // A Shift drag selects only when the app listens for it.
    const listen = () => {
      const wanted = options();
      controller.setSelection({
        onSelectionChange: wanted.onSelectionChange
          ? (range, details) => {
              if (
                dispatch(context, "onSelectionChange", range, {
                  event: details.event,
                  reason: details.reason,
                })
              ) {
                details.cancel();
              }
            }
          : undefined,
        onSelectionCommitted: wanted.onSelectionCommitted
          ? (range, details) => {
              dispatch(context, "onSelectionCommitted", range, {
                event: details.event,
                reason: details.reason,
              });
            }
          : undefined,
      });
    };
    listen();
    context.onOptions(listen);

    const zoomListeners = new Set<() => void>();
    let toldZoom = lastZoom;
    context.onDestroy(
      context.store.subscribe(() => {
        const { zoom } = context.store.get().view;
        if (zoom === toldZoom) {
          return;
        }
        toldZoom = zoom;
        for (const listener of [...zoomListeners]) {
          listener();
        }
      })
    );

    const anchor: { current: ZoomAnchor | null } = { current: null };
    const tracks = new Map<string, HTMLElement>();
    const trackControllers = new Map<string, TrackController>();
    const trackProps = new Map<string, TrackProps>();
    const markControllers = new Map<string, RangeController>();
    const markPress = new Map<string, { moved: boolean; x: number }>();
    const bump = () =>
      context.store.set({ parts: context.store.get().parts + 1 } as never);

    return {
      anchor,
      controller,
      internal: { keyOf: (value: unknown) => String(value) },
      lanes: new Set<HTMLElement>(),
      markFor: (state: TimelineState, props: MarkProps) => {
        const name = String(props.mark);
        const settings = adjustOptions(options());
        const rangeOptions = {
          disabled: state.view.disabled,
          duration: settings.duration,
          grid: settings.grid,
          largeStep: settings.largeStep,
          minLength: 0,
          movable: true,
          onValueChange: (
            range: readonly [number, number],
            details: {
              cancel: () => void;
              event: Event;
              reason: string;
            }
          ) => {
            const pointer = details.event as PointerEvent;
            const held = markPress.get(name) ?? { moved: false, x: 0 };
            if (details.reason === "drag" && !held.moved) {
              if (Math.abs(pointer.clientX - held.x) < PRESS_SLOP_PX) {
                details.cancel();
                return;
              }
              held.moved = true;
            }
            const source = sourceOf(details.event);
            if (
              dispatch(context, "onMarkChange", range[0], {
                event: details.event,
                mark: name,
                reason: details.reason,
                ...(source ? { source } : {}),
              })
            ) {
              details.cancel();
            }
          },
          onValueCommitted: (
            range: readonly [number, number],
            details: { event: Event; reason: string }
          ) => {
            dispatch(context, "onMarkCommitted", range[0], {
              event: details.event,
              mark: name,
              reason: details.reason,
            });
          },
          step: props.step ?? settings.step,
          value: [props.value, props.value] as [number, number],
          get zoom() {
            return context.store.get().view.zoom;
          },
        };
        let mark = markControllers.get(name);
        if (mark) {
          mark.setOptions(rangeOptions as never);
        } else {
          mark = createRangeController(rangeOptions as never);
          mark.subscribe(bump);
          markControllers.set(name, mark);
        }
        return mark;
      },
      markPress,
      position: createStore(
        clampFinite(
          controller.getSnapshot().position,
          0,
          context.store.get().duration
        )
      ),
      scrollerTo: { current: null as ((left: number) => void) | null },
      trackFor: (state: TimelineState, props: TrackProps, owner = false) => {
        const name = String(props.track);
        const trackOptions = {
          height: props.height,
          largeStep: props.largeStep ?? 32,
          max: props.maxHeight ?? 480,
          measure: () => tracks.get(name)?.getBoundingClientRect().height ?? 0,
          min: props.minHeight ?? 32,
          onHeightChange: (
            height: number | undefined,
            details: { cancel: () => void; event?: Event; reason: string }
          ) => {
            const source = sourceOf(details.event);
            if (
              dispatch(context, "onTrackHeightChange", height, {
                event: details.event,
                reason: details.reason,
                track: name,
                ...(source ? { source } : {}),
              })
            ) {
              details.cancel();
            }
          },
          onHeightCommitted: (
            height: number | undefined,
            details: { event?: Event; reason: string }
          ) => {
            dispatch(context, "onTrackHeightCommitted", height, {
              event: details.event,
              reason: details.reason,
              track: name,
            });
          },
          step: props.step ?? 8,
        };
        void state;
        if (owner) {
          trackProps.set(name, props);
        }
        let track = trackControllers.get(name);
        if (track) {
          if (owner) {
            track.setOptions(trackOptions as never);
          }
        } else {
          track = createTrackController(trackOptions as never);
          track.subscribe(bump);
          trackControllers.set(name, track);
        }
        return track;
      },
      trackProps,
      tracks,
      viewport: createStore<ViewportMetrics>({
        origin: 0,
        scrollStart: 0,
        width: 0,
        zoom: 0,
      }),
      viewportEl: { current: null as HTMLElement | null },
      zoom: {
        get: () => context.store.get().view.zoom,
        subscribe: (listener: () => void) => {
          zoomListeners.add(listener);
          return () => {
            zoomListeners.delete(listener);
          };
        },
      },
      zoomTo: (
        next: number,
        details: Parameters<TimelineController["zoomTo"]>[1],
        at?: ZoomAnchor
      ) => {
        if (!controller.zoomTo(next, details)) {
          return false;
        }
        anchor.current = at ?? null;
        return true;
      },
    };
  },
  controlled: ["position", "zoom"],
  name: "timeline",
  options: {
    defaultPosition: "number",
    defaultZoom: "value",
    disabled: "boolean",
    duration: "number",
    largeStep: "number",
    maxZoom: "number",
    minZoom: "number",
    onMarkChange: "callback",
    onMarkCommitted: "callback",
    onPositionChange: "callback",
    onPositionCommitted: "callback",
    onSelectionChange: "callback",
    onSelectionCommitted: "callback",
    onTrackHeightChange: "callback",
    onTrackHeightCommitted: "callback",
    onZoomChange: "callback",
    position: "number",
    snapOffset: "number",
    snapPoints: "value",
    snapStep: "number",
    source: "value",
    step: "number",
    zoom: "value",
  },
  slots: (slot) => {
    const trackView = (state: TimelineState, api: TimelineApi, props: object) =>
      api.trackFor(state, props as TrackProps).getSnapshot();

    return {
      lane: slot<{ seekable?: boolean }, TimelinePublicState>({
        attrs: (state: TimelineState) => ({
          ...stateAttrs(state),
          "data-timeline-lane": "",
          style: css({
            [UNIT_PROPERTY]: unitLength(state.view.zoom, state.duration),
            // What changes inside a lane is laid out and styled without the rest of the page.
            contain: "layout style",
            "overflow-x": "clip",
            position: "relative",
            ...(state.view.zoom === null
              ? {}
              : { "min-width": `${state.duration * state.view.zoom}px` }),
          }),
        }),
        bind: (el, part) => {
          part.api.lanes.add(el);
          return () => part.api.lanes.delete(el);
        },
        on: {
          pointerdown: (event, { api, el, props, store }) => {
            if (
              !(el && props.seekable) ||
              store.get().view.disabled ||
              event.button !== 0 ||
              event.target !== el
            ) {
              return;
            }
            api.controller.pressSeek(event, el, el);
          },
        },
        props: { seekable: "boolean" },
        state: (state: TimelineState) => publicState(state),
      }),
      mark: slot<MarkProps, MarkPublicState>({
        attrs: (state: TimelineState, { api, props }) => {
          const moving = props.movable
            ? api.markFor(state, props).getSnapshot()
            : undefined;
          return {
            ...stateAttrs(state),
            "data-dragging": flag(Boolean(moving?.dragging)),
            style: css(placedAt(moving ? moving.value[0] : props.value)),
          };
        },
        // A press that became a drag keeps its click from reaching what is under it.
        bind: (el, part) => {
          const swallow = (event: Event) => {
            const held = part.api.markPress.get(String(part.props.mark));
            if (held?.moved) {
              held.moved = false;
              event.preventDefault();
              event.stopPropagation();
            }
          };
          el.addEventListener("click", swallow, true);
          return () => el.removeEventListener("click", swallow, true);
        },
        on: {
          keydown: (event, { api, props, store }) => {
            if (
              !props.movable ||
              (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              inField(event.target)
            ) {
              return;
            }
            if (api.markFor(store.get(), props).keyDown(event)) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
          pointerdown: (event, { api, el, props, store }) => {
            if (!props.movable || event.button !== 0 || inField(event.target)) {
              return;
            }
            // The press stops here, so the lane underneath doesn't take it.
            event.stopPropagation();
            api.markPress.set(String(props.mark), {
              moved: false,
              x: event.clientX,
            });
            api
              .markFor(store.get(), props)
              .press(
                "both",
                event,
                event.target as Element,
                laneOf(el ?? null)
              );
          },
        },
        props: {
          mark: "key",
          movable: "boolean",
          step: "number",
          value: "number",
        },
        state: (state: TimelineState, { api, props }) => ({
          ...publicState(state),
          dragging: props.movable
            ? api.markFor(state, props).getSnapshot().dragging
            : false,
        }),
      }),
      // A marker at the playback position, following it straight in the DOM.
      playhead: slot<object, TimelinePublicState>({
        attrs: (state: TimelineState, { api }) => ({
          ...stateAttrs(state),
          "aria-hidden": "true",
          style: css(placedAt(api.position.get())),
        }),
        bind: (el, part) => {
          const follow = () =>
            el.style.setProperty(
              OFFSET_PROPERTY,
              String(part.api.position.get())
            );
          follow();
          const offPosition = part.api.position.subscribe(follow);
          const offStore = part.store.subscribe(follow);
          return () => {
            offPosition();
            offStore();
          };
        },
        state: (state: TimelineState) => publicState(state),
      }),
      root: slot<object, TimelinePublicState>({
        attrs: (state: TimelineState) => stateAttrs(state),
        // The position reaches the DOM outside any render: a live source paints every frame.
        bind: (el, part) => {
          const { controller, position } = part.api;
          void el;
          const paint = () =>
            position.set(
              clampFinite(
                controller.getSnapshot().position,
                0,
                part.store.get().duration
              )
            );
          let followed: PositionSource | undefined;
          let unfollow = () => undefined as void;
          const watch = () => {
            const live = (
              part.store.get() as TimelineState & {
                source?: PositionSource;
              }
            ).source;
            if (live !== followed) {
              unfollow();
              followed = live;
              unfollow = live ? live.subscribe(paint) : () => undefined;
            }
            paint();
          };
          watch();
          const offController = controller.subscribe(paint);
          const offStore = part.store.subscribe(watch);
          return () => {
            offController();
            offStore();
            unfollow();
          };
        },
        state: (state: TimelineState) => publicState(state),
      }),
      // The lane that moves the position: a press jumps to the pointer and a drag scrubs.
      ruler: slot<object, TimelinePublicState>({
        attrs: (state: TimelineState) => ({
          ...stateAttrs(state),
          "data-timeline-lane": "",
          style: css({
            [UNIT_PROPERTY]: unitLength(state.view.zoom, state.duration),
            contain: "layout style",
            "overflow-x": "clip",
            position: "relative",
            "touch-action": "none",
            ...(state.view.zoom === null
              ? {}
              : { "min-width": `${state.duration * state.view.zoom}px` }),
          }),
        }),
        bind: (el, part) => {
          part.api.lanes.add(el);
          return () => part.api.lanes.delete(el);
        },
        on: {
          pointerdown: (event, { api, el, store }) => {
            if (!el || store.get().view.disabled || event.button !== 0) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            api.controller.pressRuler(event, el, el);
          },
        },
        state: (state: TimelineState) => publicState(state),
      }),
      rulerInput: slot<{ getAriaValueText?: DescribePosition }>({
        attrs: (state: TimelineState, { api, props }) => ({
          "aria-valuetext": (props.getAriaValueText ?? describeAsNumber)(
            api.position.get(),
            state.duration
          ),
          disabled: flag(state.view.disabled),
          max: String(state.duration),
          min: "0",
          step: "any",
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(api.position.get()),
        }),
        // The input follows the position outside any render, like the playhead.
        bind: (el, part) => {
          const input = el as HTMLInputElement;
          const follow = () => {
            const value = part.api.position.get();
            const text = (part.props.getAriaValueText ?? describeAsNumber)(
              value,
              part.store.get().duration
            );
            if (input.getAttribute("aria-valuetext") !== text) {
              input.setAttribute("aria-valuetext", text);
            }
            input.value = String(value);
          };
          follow();
          return part.api.position.subscribe(follow);
        },
        on: {
          change: (event, { api, el }) =>
            api.controller.typeAt(
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
      }),
      // One track of the arrangement: a row holding a header beside a lane.
      track: slot<TrackProps, TrackPublicState>({
        attrs: (state: TimelineState, { api, props }) => ({
          ...stateAttrs(state),
          "data-resizing": flag(
            api.trackFor(state, props, true).getSnapshot().resizing
          ),
          "data-selected": flag(Boolean(props.selected)),
          "data-track": String(props.track),
          style: css({
            display: "flex",
            "min-width": "100%",
            ...(props.height === undefined
              ? {}
              : { height: `${props.height}px` }),
          }),
        }),
        bind: (el, part) => {
          const name = String(part.props.track);
          part.api.tracks.set(name, el);
          return () => part.api.tracks.delete(name);
        },
        props: {
          height: "number",
          largeStep: "number",
          maxHeight: "number",
          minHeight: "number",
          selected: "boolean",
          step: "number",
          track: "key",
        },
        state: (state: TimelineState, { api, props }) => ({
          ...publicState(state),
          resizing: trackView(state, api, props).resizing,
          selected: Boolean(props.selected),
        }),
      }),
      // The strip beside a track's lane that names it: it stays at the left edge while the lane scrolls.
      trackHeader: slot<object, TrackPublicState>({
        attrs: (state: TimelineState) => ({
          ...stateAttrs(state),
          style: css({
            "flex-shrink": "0",
            left: "0",
            position: "sticky",
            "z-index": "var(--timeline-track-header-z, 20)",
          }),
        }),
        state: (state: TimelineState) => ({
          ...publicState(state),
          resizing: false,
          selected: false,
        }),
      }),
      trackResizeHandle: slot<TrackRef, TrackPublicState>({
        attrs: (state: TimelineState, { api, props }) => ({
          ...stateAttrs(state),
          "data-resizing": flag(trackView(state, api, props).resizing),
          style: css({ "touch-action": "none" }),
        }),
        on: {
          dblclick: (event, { api, props, store }) =>
            api.trackFor(store.get(), props).reset(event),
          pointerdown: (event, { api, el, props, store }) => {
            // The track's own press (to pick it) is not this one.
            event.stopPropagation();
            if (!el || event.button !== 0) {
              return;
            }
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            api.trackFor(store.get(), props).press(event, el);
          },
        },
        props: { track: "key" },
        state: (state: TimelineState, { api, props }) => ({
          ...publicState(state),
          resizing: trackView(state, api, props).resizing,
          selected: false,
        }),
      }),
      trackResizeInput: slot<TrackRef>({
        attrs: (_state: TimelineState, { api, props }) => {
          const given = api.trackProps.get(String(props.track));
          return {
            "aria-orientation": "vertical",
            max: String(given?.maxHeight ?? 480),
            min: String(given?.minHeight ?? 32),
            step: "any",
            style: css(VISUALLY_HIDDEN),
            type: "range",
            value: String(given?.height ?? given?.minHeight ?? 32),
          };
        },
        on: {
          change: (event, { api, el, props, store }) =>
            api
              .trackFor(store.get(), props)
              .typeAt(Number((el as HTMLInputElement).value), event),
          keydown: (event, { api, props, store }) => {
            if (api.trackFor(store.get(), props).keyDown(event)) {
              event.preventDefault();
            }
          },
        },
        props: { track: "key" },
      }),
      // The scrolling window onto the timeline: Cmd/Ctrl + wheel zooms around the pointer.
      viewport: slot<object, TimelinePublicState>({
        attrs: (state: TimelineState) => ({
          ...stateAttrs(state),
          "data-timeline-viewport": "",
          style: css({ "overflow-x": "auto" }),
        }),
        bind: (el, part) => {
          const { api, store } = part;
          api.viewportEl.current = el;
          let previous: { scrollStart: number; zoom: number } | null = null;

          const origin = () => {
            const lane = originLane(api.lanes);
            if (!lane) {
              return 0;
            }
            return (
              (lane.getBoundingClientRect().left -
                el.getBoundingClientRect().left) /
                layoutScale(el) +
              el.scrollLeft
            );
          };
          const drawnZoom = () => {
            const { duration, view } = store.get();
            if (view.zoom !== null) {
              return view.zoom;
            }
            const width =
              (originLane(api.lanes)?.getBoundingClientRect().width ?? 0) /
              layoutScale(el);
            return width / Math.max(duration, Number.MIN_VALUE);
          };
          const wheelOptions = () => ({
            disabled: store.get().view.disabled,
            drawnZoom,
            duration: store.get().duration,
            origin,
            zoomTo: api.zoomTo,
          });
          const wheelZoom = createWheelZoom(wheelOptions());

          const report = () => {
            const next = {
              origin: origin(),
              scrollStart: el.scrollLeft,
              width: el.clientWidth,
              zoom: drawnZoom(),
            };
            const current = api.viewport.get();
            if (
              current.origin !== next.origin ||
              current.scrollStart !== next.scrollStart ||
              current.width !== next.width ||
              current.zoom !== next.zoom
            ) {
              api.viewport.set(next);
            }
          };
          api.scrollerTo.current = (left: number) => {
            el.scrollLeft = left;
            if (previous) {
              previous.scrollStart = el.scrollLeft;
            }
            report();
          };
          report();

          // A resize is reported on the next frame, so the lanes are not styled inside the layout pass that measured them.
          let frame = 0;
          const observer =
            typeof ResizeObserver === "undefined"
              ? null
              : new ResizeObserver(() => {
                  cancelAnimationFrame(frame);
                  frame = requestAnimationFrame(report);
                });
          observer?.observe(el);

          // The one place that reacts to the zoom changing, once the lanes are laid out again.
          let applying = 0;
          const settle = () => {
            const current = drawnZoom();
            if (previous && previous.zoom > 0 && previous.zoom !== current) {
              const middle = el.clientWidth / 2;
              const at = api.anchor.current ?? {
                offset: middle,
                value: valueAtOffset(
                  middle,
                  previous.scrollStart,
                  previous.zoom,
                  origin()
                ),
              };
              api.anchor.current = null;
              el.scrollLeft = anchoredScroll(at, current, origin());
            }
            previous = { scrollStart: el.scrollLeft, zoom: current };
            report();
          };
          settle();
          let lastZoom = store.get().view.zoom;
          const offStore = store.subscribe(() => {
            wheelZoom.setOptions(wheelOptions());
            const { zoom } = store.get().view;
            if (zoom !== lastZoom) {
              lastZoom = zoom;
              cancelAnimationFrame(applying);
              applying = requestAnimationFrame(settle);
            }
          });

          // Attached natively: a passive listener could not stop the page from scrolling while it zooms.
          const handleWheel = (event: WheelEvent) => {
            wheelZoom.wheel(event, el);
          };
          el.addEventListener("wheel", handleWheel, { passive: false });
          const handleScroll = () => {
            if (previous) {
              previous.scrollStart = el.scrollLeft;
            }
            report();
          };
          el.addEventListener("scroll", handleScroll);
          return () => {
            offStore();
            cancelAnimationFrame(frame);
            cancelAnimationFrame(applying);
            observer?.disconnect();
            el.removeEventListener("wheel", handleWheel);
            el.removeEventListener("scroll", handleScroll);
            wheelZoom.dispose();
            api.viewportEl.current = null;
            api.scrollerTo.current = null;
          };
        },
        state: (state: TimelineState) => publicState(state),
      }),
    };
  },
  state: (options: TimelinePrimitiveOptions): TimelineState => {
    const view = viewOf(options);
    return {
      duration: options.duration ?? 1,
      parts: 0,
      position: view.position,
      source: options.source,
      view,
      zoom: view.zoom,
    } as TimelineState;
  },
  sync: (options: TimelinePrimitiveOptions) => ({
    duration: options.duration ?? 1,
    ...(options.position === undefined ? {} : { position: options.position }),
    source: options.source,
    ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
  }),
});
