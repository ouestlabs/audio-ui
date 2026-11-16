import {
  clampFinite,
  createStore,
  normalizeRange,
  type Source,
  type Store,
} from "@audio-ui/core";
import {
  attachWaveformBars,
  attachWaveformCanvas,
  createWaveformController,
  createWaveformRegionController,
  isAudible,
  type WaveformIdle,
  type WaveformPeaks,
  type WaveformRegionController,
  type WaveformRegionEdge,
  type WaveformRegionValue,
  type WaveformSeekController,
  type WaveformSeekSnapshot,
} from "@audio-ui/core/waveform";
import {
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
  connectController,
  flag,
  noop,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../shared.ts";

/**
 * The waveform as a UI SDK primitive, over the seek and region controllers of
 * `@audio-ui/core`: the press, the scrub, the keys, the Shift + drag selection
 * and the regions stay in the controllers; the canvas and the bars are painted
 * by the core painters, outside any render.
 *
 * The position reaches the DOM in one place, the Root's `bind`: the
 * `--waveform-position` CSS variable the playhead and thumb follow, the store
 * the painters read, and the input assistive technology reads. A live `source`
 * therefore paints every frame with no render.
 *
 * A region is named, by its `region` prop, and holds a controller of its own.
 * What it reports goes through the Root, `onRegionChange` and
 * `onRegionCommitted`, with the region's name and the edge in the details.
 */

const POSITION_PROPERTY = "--waveform-position";
const LEVEL_PROPERTY = "--waveform-level";

/** A share of the track is meaningful whatever unit `duration` is in. */
const describeAsPercent = (value: number, duration: number) =>
  `${Math.round((duration > 0 ? value / duration : 0) * 100)}%`;

export type DescribeValue = (value: number, duration: number) => string;

/** A live position, in `duration` units. */
export type PositionSource = Source<number>;

/** A live signal: the current levels, 0…1 each. */
export type LevelsSource = Source<ArrayLike<number>>;

export interface WaveformPrimitiveOptions {
  defaultValue?: number;
  disabled?: boolean;
  /** Length of the audio, in the unit `value` is in. @default 1 */
  duration?: number;
  /** Step for Page Up/Page Down and Shift + arrow keys. Defaults to a tenth of `duration`. */
  largeStep?: number;
  /** A live signal drawn outside any render, instead of `peaks`. */
  levels?: LevelsSource;
  /** Whether the audio is still on its way. @default false */
  loading?: boolean;
  /** The form field's name. */
  name?: string;
  /** A Shift + drag moved the selection: `[start, end]`, with `details.cancel()` to keep it. */
  onRegionChange?: (
    value: WaveformRegionValue,
    details: RegionChangeDetails
  ) => void;
  onRegionCommitted?: (
    value: WaveformRegionValue,
    details: RegionCommitDetails
  ) => void;
  onSelectionChange?: (
    range: readonly [number, number],
    details: ChangeDetails
  ) => void;
  onSelectionCommitted?: (
    range: readonly [number, number],
    details: CommitDetails
  ) => void;
  onValueChange?: (value: number, details: ChangeDetails) => void;
  onValueCommitted?: (value: number, details: CommitDetails) => void;
  /** The audio's shape: a level per slice, or `{ min, max }` samples per slice. */
  peaks?: WaveformPeaks;
  /** The stretch of the audio shown, `[start, end]` in `duration` units. */
  range?: readonly [number, number];
  /** A live position followed outside any render; takes precedence over `value`. */
  source?: PositionSource;
  /** Step for the arrow keys. Defaults to a hundredth of `duration`. */
  step?: number;
  value?: number;
}

/** What a region's change reports. */
export interface RegionChangeDetails extends ChangeDetails {
  edge: WaveformRegionEdge;
  /** The name of the region that moved. */
  region: string;
}

/** What a region's commit reports. */
export interface RegionCommitDetails extends CommitDetails {
  edge: WaveformRegionEdge;
  region: string;
}

export interface WaveformState {
  duration: number;
  levels: LevelsSource | undefined;
  loading: boolean;
  name: string | undefined;
  peaks: WaveformPeaks | undefined;
  /** Counts the changes a region's controller made, so the parts read them again. */
  regions: number;
  /** The live position the waveform follows, when it has one. */
  source: PositionSource | undefined;
  value: number;
  view: WaveformSeekSnapshot;
}

/** What a part reads of the waveform. */
export interface WaveformPublicState {
  disabled: boolean;
  /** Whether a pointer is scrubbing the waveform. */
  dragging: boolean;
  /** Whether the audio is still on its way: there is nothing to seek yet. */
  loading: boolean;
}

/** What a region's parts read of it. */
export interface RegionPublicState extends WaveformPublicState {
  /** The region, as `[start, end]`. */
  value: WaveformRegionValue;
}

/** What a bar reads of itself. */
export interface BarPublicState extends WaveformPublicState {
  index: number;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a region part: its name, and what it holds. */
export interface RegionProps extends PartProps {
  defaultValue?: WaveformRegionValue;
  disabled?: boolean;
  minLength?: number;
  movable?: boolean;
  /** The name of the region: what keys it and what its changes report. */
  region: string;
  value?: WaveformRegionValue;
}

/** What a waveform's `api` gives an adapter. */
export interface WaveformApi {
  /** The nodes of the bars, by index, which the bars painter writes to. */
  bars: { minLevel: number; nodes: Map<number, HTMLElement> };
  controller: WaveformSeekController;
  /** How the position is announced; set by the input. */
  describe: { current: DescribeValue };
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (value: unknown) => string };
  /** The played share, 0…1, observable outside any render. */
  position: Store<number>;
  /** The controller of the region named in `props`, with the latest props. */
  regionFor: (
    state: WaveformState,
    props: RegionProps | RegionPartProps,
    /** Whether `props` are the region part's own, which hold what the region is given. */
    owner?: boolean
  ) => WaveformRegionController;
}

/** The props of a region's edge parts. */
export interface RegionPartProps extends PartProps {
  getAriaValueText?: DescribeValue;
  region: string;
}

/** The painters' props, which a part passes through. */
export interface CanvasProps extends PartProps {
  barGap?: number;
  barRadius?: number;
  barWidth?: number;
  gain?: number;
  idle?: WaveformIdle;
  lineWidth?: number;
  minBarHeight?: number;
  mirrored?: boolean;
  mode?: "scrolling" | "static";
  scrollSpeed?: number;
  variant?: "bars" | "line" | "mirror" | "scope";
}

export interface BarsProps extends PartProps {
  count?: number;
  gain?: number;
  idle?: WaveformIdle;
  minLevel?: number;
  mirrored?: boolean;
}

type Slot<Props, Public = WaveformPublicState> = SlotDefinition<
  WaveformState,
  WaveformApi,
  Props,
  Public
>;

/** The waveform's slots, by name, with the props and the public state of each. */
export type WaveformSlots = {
  bar: Slot<PartProps & { index: number }, BarPublicState>;
  bars: Slot<BarsProps>;
  canvas: Slot<CanvasProps>;
  control: Slot<PartProps>;
  hover: Slot<PartProps & { format?: (value: number) => string }>;
  input: Slot<PartProps & { getAriaValueText?: DescribeValue }, object>;
  marker: Slot<PartProps & { value: number }>;
  playhead: Slot<PartProps>;
  region: Slot<RegionProps, RegionPublicState>;
  regionEnd: Slot<RegionPartProps, RegionPublicState>;
  regionEndInput: Slot<RegionPartProps, object>;
  regionStart: Slot<RegionPartProps, RegionPublicState>;
  regionStartInput: Slot<RegionPartProps, object>;
  root: Slot<PartProps>;
  thumb: Slot<PartProps>;
};

/** The type of `waveform`, written out so a declaration can print it. */
export interface WaveformPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: WaveformSlots;
  (
    initialOptions: WaveformPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: WaveformApi;
    get: () => WaveformState;
    types: {
      api: WaveformApi;
      options: WaveformPrimitiveOptions;
      slots: WaveformSlots;
      state: WaveformState;
    };
  };
}

/** The options the seek controller needs, with the defaults the React waveform gave. */
function adjustOptions(options: Record<string, unknown>) {
  const duration = (options.duration as number | undefined) ?? 1;
  const rangeProp = options.range as readonly [number, number] | undefined;
  const [start, end] = rangeProp
    ? normalizeRange(rangeProp, duration)
    : [0, duration];
  return {
    ...options,
    duration,
    largeStep: (options.largeStep as number | undefined) ?? duration / 10,
    range: end > start ? ([start, end] as const) : ([0, duration] as const),
    step: (options.step as number | undefined) ?? duration / 100,
  };
}

/** What a waveform with these options shows before anything moves it. */
function viewOf(options: WaveformPrimitiveOptions): WaveformSeekSnapshot {
  const controller = createWaveformController(
    adjustOptions(options as never) as never
  );
  return controller.getSnapshot();
}

const publicState = (state: WaveformState): WaveformPublicState => ({
  disabled: state.view.disabled,
  dragging: state.view.dragging,
  loading: state.loading,
});

const stateAttrs = (state: WaveformState) => ({
  "data-disabled": flag(state.view.disabled),
  "data-dragging": flag(state.view.dragging),
  "data-loading": flag(state.loading),
});

const percentOf = (share: number) =>
  `${Math.min(1, Math.max(0, share)) * 100}%`;

/** The element a region's pixels are measured on: the track it is positioned in. */
const trackOf = (region: Element | null): Element | null =>
  region
    ? ((region as HTMLElement).offsetParent ?? region.parentElement)
    : null;

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Runs `attach` again whenever what it draws from changes: the root's state, a
 * part's props (written as `data-paint`), or the part's element.
 */
function repaint(
  el: HTMLElement,
  store: Store<WaveformState>,
  signature: () => unknown[],
  attach: () => () => void
) {
  let last: unknown[] = [];
  let detach: () => void = noop;
  const run = () => {
    const next = signature();
    if (
      next.length === last.length &&
      next.every((value, index) => Object.is(value, last[index]))
    ) {
      return;
    }
    last = next;
    detach();
    detach = attach();
  };
  run();
  const off = store.subscribe(run);
  const observer = new MutationObserver(run);
  observer.observe(el, { attributeFilter: ["data-paint"], attributes: true });
  return () => {
    off();
    observer.disconnect();
    detach();
    last = [];
  };
}

const paintSignature = (props: object) =>
  JSON.stringify(props, (_key, value) =>
    typeof value === "function" ? undefined : value
  );

export const waveform: WaveformPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const controller: WaveformSeekController = createWaveformController(
      adjustOptions(context.options() as never) as never
    );
    connectController(context, controller as never, adjustOptions);

    // A Shift + drag selects only when the app listens for it.
    const listen = () => {
      const options = context.options() as WaveformPrimitiveOptions;
      controller.setSelection({
        onSelectionChange: options.onSelectionChange
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
        onSelectionCommitted: options.onSelectionCommitted
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

    const regions = new Map<string, WaveformRegionController>();
    const position = createStore(controller.toShare(context.store.get().value));

    return {
      bars: { minLevel: 0.08, nodes: new Map<number, HTMLElement>() },
      controller,
      describe: { current: describeAsPercent },
      internal: { keyOf: (value: unknown) => String(value) },
      position,
      regionFor: (
        state: WaveformState,
        props: RegionProps | RegionPartProps,
        owner = false
      ) => {
        const name = String(props.region);
        const wanted = props as RegionProps;
        const options = {
          defaultValue: wanted.defaultValue,
          disabled: state.view.disabled || Boolean(wanted.disabled),
          duration: state.view.duration,
          largeStep: state.view.largeStep,
          minLength: wanted.minLength ?? state.view.step,
          onValueChange: (
            value: WaveformRegionValue,
            details: {
              cancel: () => void;
              edge: WaveformRegionEdge;
              event?: Event;
              reason: string;
            }
          ) => {
            const source = sourceOf(details.event);
            if (
              dispatch(context, "onRegionChange", value, {
                edge: details.edge,
                event: details.event,
                reason: details.reason,
                region: name,
                ...(source ? { source } : {}),
              })
            ) {
              details.cancel();
            }
          },
          onValueCommitted: (
            value: WaveformRegionValue,
            details: {
              edge: WaveformRegionEdge;
              event?: Event;
              reason: string;
            }
          ) => {
            dispatch(context, "onRegionCommitted", value, {
              edge: details.edge,
              event: details.event,
              reason: details.reason,
              region: name,
            });
          },
          step: state.view.step,
          value: wanted.value,
        };
        let region = regions.get(name);
        if (region) {
          // The region is told the props of its newest render, as the React one is.
          if (owner) {
            region.setOptions(options);
          }
        } else {
          region = createWaveformRegionController(options);
          region.subscribe(() =>
            context.store.set({ regions: context.store.get().regions + 1 })
          );
          regions.set(name, region);
        }
        return region;
      },
    };
  },
  controlled: ["value"],
  name: "waveform",
  options: {
    defaultValue: "number",
    disabled: "boolean",
    duration: "number",
    largeStep: "number",
    levels: "value",
    loading: "boolean",
    name: "string",
    onRegionChange: "callback",
    onRegionCommitted: "callback",
    onSelectionChange: "callback",
    onSelectionCommitted: "callback",
    onValueChange: "callback",
    onValueCommitted: "callback",
    peaks: "value",
    range: "value",
    source: "value",
    step: "number",
    value: "number",
  },
  slots: (slot) => {
    /** A part that follows the region named in its props. */
    const regionState = (
      state: WaveformState,
      api: WaveformApi,
      props: object
    ) => api.regionFor(state, props as RegionProps).getSnapshot();

    const edgeSlot = (edge: "end" | "start") =>
      slot<RegionPartProps, RegionPublicState>({
        attrs: (state: WaveformState, { api, props }) => {
          const view = regionState(state, api, props);
          return {
            "data-disabled": flag(view.disabled),
            "data-dragging": flag(view.dragging),
            "data-edge": edge,
            "data-region": String(props.region),
            style: css({ "touch-action": "none" }),
          };
        },
        on: {
          pointerdown: (event, { api, el, props, store }) => {
            if (event.button !== 0) {
              return;
            }
            // The press stops here, so the control underneath takes no seek.
            event.stopPropagation();
            const controller = api.regionFor(store.get(), props);
            if (!el || controller.getSnapshot().disabled) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            const regionEl = el.closest<HTMLElement>(
              '[data-slot="waveform-region"]'
            );
            controller.press(
              edge,
              event,
              el,
              trackOf(regionEl),
              store.get().view.range
            );
          },
        },
        props: { getAriaValueText: "value", region: "key" },
        state: (state: WaveformState, { api, props }) => ({
          ...publicState(state),
          value: regionState(state, api, props).value,
        }),
      });

    const edgeInputSlot = (edge: "end" | "start") =>
      slot<RegionPartProps>({
        attrs: (state: WaveformState, { api, props }) => {
          const controller = api.regionFor(state, props);
          const view = controller.getSnapshot();
          const current = edge === "start" ? view.value[0] : view.value[1];
          const [min, max] = controller.edgeRange(edge);
          return {
            "aria-valuetext": (props.getAriaValueText ?? describeAsPercent)(
              current,
              state.view.duration
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
          change: (event, { api, el, props, store }) =>
            api
              .regionFor(store.get(), props)
              .typeAt(edge, Number((el as HTMLInputElement).value), event),
          keydown: (event, { api, props, store }) => {
            if (api.regionFor(store.get(), props).keyDown(edge, event)) {
              event.preventDefault();
            }
          },
        },
        props: { getAriaValueText: "value", region: "key" },
      });

    return {
      bar: slot<{ index: number }, BarPublicState>({
        attrs: (_state: WaveformState, { api, props }) => ({
          "data-index": String(props.index),
          style: css({ [LEVEL_PROPERTY]: String(api.bars.minLevel) }),
        }),
        bind: (el, part) => {
          const index = Number(part.props.index);
          part.api.bars.nodes.set(index, el);
          return () => {
            if (part.api.bars.nodes.get(index) === el) {
              part.api.bars.nodes.delete(index);
            }
          };
        },
        props: { index: "key" },
        state: (state: WaveformState, { props }) => ({
          ...publicState(state),
          index: Number(props.index),
        }),
      }),
      bars: slot<BarsProps, WaveformPublicState>({
        attrs: (state: WaveformState, { api, props }) => {
          api.bars.minLevel = props.minLevel ?? 0.08;
          return {
            ...stateAttrs(state),
            "data-paint": paintSignature(props),
          };
        },
        bind: (el, part) =>
          repaint(
            el,
            part.store,
            () => {
              const state = part.store.get();
              return [
                paintSignature(part.props),
                state.duration,
                state.levels,
                state.loading,
                state.peaks,
                state.view.range[0],
                state.view.range[1],
              ];
            },
            () => {
              const state = part.store.get();
              const { count = 24, gain, idle, minLevel, mirrored } = part.props;
              return attachWaveformBars(
                el,
                (index) => part.api.bars.nodes.get(index),
                {
                  count,
                  duration: state.duration,
                  gain,
                  idle,
                  levels: state.levels,
                  loading: state.loading,
                  minLevel,
                  mirrored,
                  peaks: state.peaks,
                  played: part.api.position,
                  range: state.view.range,
                  reducedMotion: reducedMotion(),
                }
              );
            }
          ),
        props: {
          count: "number",
          gain: "number",
          idle: "string",
          minLevel: "number",
          mirrored: "boolean",
        },
        state: (state: WaveformState) => publicState(state),
      }),
      canvas: slot<CanvasProps, WaveformPublicState>({
        attrs: (state: WaveformState, { props }) => ({
          ...stateAttrs(state),
          "aria-hidden": "true",
          "data-paint": paintSignature(props),
        }),
        bind: (el, part) =>
          repaint(
            el,
            part.store,
            () => {
              const state = part.store.get();
              return [
                paintSignature(part.props),
                state.duration,
                state.levels,
                state.loading,
                state.peaks,
                state.view.range[0],
                state.view.range[1],
              ];
            },
            () => {
              const state = part.store.get();
              return attachWaveformCanvas(el as HTMLCanvasElement, {
                ...part.props,
                duration: state.duration,
                levels: state.levels,
                loading: state.loading,
                peaks: state.peaks,
                played: part.api.position,
                range: state.view.range,
                reducedMotion: reducedMotion(),
              });
            }
          ),
        props: {
          barGap: "number",
          barRadius: "number",
          barWidth: "number",
          gain: "number",
          idle: "string",
          lineWidth: "number",
          minBarHeight: "number",
          mirrored: "boolean",
          mode: "string",
          scrollSpeed: "number",
          variant: "string",
        },
        state: (state: WaveformState) => publicState(state),
      }),
      control: slot<object, WaveformPublicState>({
        attrs: (state: WaveformState) => ({
          ...stateAttrs(state),
          style: css({ position: "relative", "touch-action": "none" }),
        }),
        on: {
          pointerdown: (event, { api, el, store }) => {
            const { view } = store.get();
            if (
              !el ||
              view.disabled ||
              store.get().loading ||
              event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            api.controller.pressSeek(event, el);
          },
          pointerleave: (_event, { api }) => api.controller.leave(),
          pointermove: (event, { api, el, store }) => {
            if (!el || store.get().view.disabled || store.get().loading) {
              return;
            }
            api.controller.hoverAt(event.clientX, el);
          },
        },
        state: (state: WaveformState) => publicState(state),
      }),
      // Shown while the pointer is over the control, at the hovered point.
      hover: slot<{ format?: (value: number) => string }, WaveformPublicState>({
        attrs: (state: WaveformState) => ({
          ...stateAttrs(state),
          "aria-hidden": "true",
          hidden: "",
          style: css({ position: "absolute" }),
        }),
        bind: (el, part) => {
          const text = document.createTextNode("");
          el.appendChild(text);
          const paint = () => {
            const hovered = part.api.controller.hover.get();
            const state = part.store.get();
            const shown =
              hovered !== null && !(state.view.disabled || state.loading);
            el.toggleAttribute("hidden", !shown);
            if (!shown) {
              return;
            }
            el.style.left = percentOf(part.api.controller.toShare(hovered));
            const next = part.props.format?.(hovered) ?? "";
            if (text.nodeValue !== next) {
              text.nodeValue = next;
            }
          };
          paint();
          const off = part.api.controller.hover.subscribe(paint);
          return () => {
            off();
            text.remove();
          };
        },
        props: { format: "value" },
        state: (state: WaveformState) => publicState(state),
      }),
      input: slot<{ getAriaValueText?: DescribeValue }>({
        attrs: (state: WaveformState, { api, props }) => {
          // Kept current for the paints that happen outside any render.
          api.describe.current = props.getAriaValueText ?? describeAsPercent;
          return {
            "aria-valuetext": api.describe.current(
              state.view.value,
              state.view.duration
            ),
            disabled: flag(state.view.disabled),
            max: String(state.view.range[1]),
            min: String(state.view.range[0]),
            name: state.name,
            step: "any",
            style: css(VISUALLY_HIDDEN),
            type: "range",
            value: String(state.view.value),
          };
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
      marker: slot<{ value: number }, WaveformPublicState>({
        attrs: (state: WaveformState, { api, props }) => ({
          ...stateAttrs(state),
          style: css({
            left: percentOf(
              api.controller.toShare(
                clampFinite(Number(props.value), 0, state.duration)
              )
            ),
            position: "absolute",
          }),
        }),
        props: { value: "number" },
        state: (state: WaveformState) => publicState(state),
      }),
      playhead: slot<object, WaveformPublicState>({
        attrs: (state: WaveformState) => ({
          ...stateAttrs(state),
          "aria-hidden": "true",
          style: css({
            left: `var(${POSITION_PROPERTY})`,
            position: "absolute",
          }),
        }),
        state: (state: WaveformState) => publicState(state),
      }),
      region: slot<RegionProps, RegionPublicState>({
        attrs: (state: WaveformState, { api, props }) => {
          const view = api
            .regionFor(state, props as RegionProps, true)
            .getSnapshot();
          const [from, to] = state.view.range;
          const span = to - from;
          const share = (length: number) =>
            `${(span > 0 ? length / span : 0) * 100}%`;
          return {
            "data-disabled": flag(view.disabled),
            "data-dragging": flag(view.dragging),
            "data-region": String(props.region),
            style: css({
              left: share(view.value[0] - from),
              position: "absolute",
              "touch-action": "none",
              width: share(view.value[1] - view.value[0]),
            }),
          };
        },
        on: {
          pointerdown: (event, { api, el, props, store }) => {
            if (event.button !== 0) {
              return;
            }
            event.stopPropagation();
            const controller = api.regionFor(store.get(), props, true);
            if (
              !el ||
              props.movable === false ||
              controller.getSnapshot().disabled
            ) {
              return;
            }
            event.preventDefault();
            controller.press(
              "both",
              event,
              el,
              trackOf(el),
              store.get().view.range
            );
          },
        },
        props: {
          defaultValue: "value",
          disabled: "boolean",
          minLength: "number",
          movable: "boolean",
          region: "key",
          value: "value",
        },
        state: (state: WaveformState, { api, props }) => ({
          ...publicState(state),
          value: regionState(state, api, props).value,
        }),
      }),
      regionEnd: edgeSlot("end"),
      regionEndInput: edgeInputSlot("end"),
      regionStart: edgeSlot("start"),
      regionStartInput: edgeInputSlot("start"),
      root: slot<object, WaveformPublicState>({
        attrs: (state: WaveformState, { api }) => ({
          ...stateAttrs(state),
          style: css({
            [POSITION_PROPERTY]: percentOf(
              api.controller.toShare(state.view.value)
            ),
          }),
        }),
        // The single place a position reaches the DOM, outside any render.
        bind: (el, part) => {
          const { controller, position } = part.api;
          const paint = () => {
            const { duration } = part.store.get();
            const next = clampFinite(
              controller.getSnapshot().value,
              0,
              duration
            );
            const share = controller.toShare(next);
            el.style.setProperty(POSITION_PROPERTY, percentOf(share));
            // Outside the stretch shown, a playhead has nowhere true to stand.
            el.toggleAttribute("data-outside", share < 0 || share > 1);
            position.set(share);
            const input = el.querySelector<HTMLInputElement>(
              '[data-slot="waveform-input"]'
            );
            if (input) {
              const text = part.api.describe.current(next, duration);
              if (input.getAttribute("aria-valuetext") !== text) {
                input.setAttribute("aria-valuetext", text);
                input.value = String(next);
              }
            }
          };
          let followed: PositionSource | undefined;
          let unfollow: () => void = noop;
          let heard: LevelsSource | undefined;
          let unhear: () => void = noop;
          const mark = () => {
            const { levels } = part.store.get();
            el.toggleAttribute(
              "data-active",
              levels ? isAudible(levels.getSnapshot()) : false
            );
          };
          const watch = () => {
            const live = part.store.get().source;
            if (live !== followed) {
              unfollow();
              followed = live;
              unfollow = live ? live.subscribe(paint) : () => undefined;
            }
            const { levels } = part.store.get();
            if (levels !== heard) {
              unhear();
              heard = levels;
              unhear = levels ? levels.subscribe(mark) : () => undefined;
            }
            mark();
            paint();
          };
          watch();
          const offSnapshot = controller.subscribe(paint);
          const offStore = part.store.subscribe(watch);
          return () => {
            offSnapshot();
            offStore();
            unfollow();
            unhear();
            el.removeAttribute("data-active");
          };
        },
        state: (state: WaveformState) => publicState(state),
      }),
      thumb: slot<object, WaveformPublicState>({
        attrs: (state: WaveformState) => ({
          ...stateAttrs(state),
          "aria-hidden": "true",
          style: css({
            left: `var(${POSITION_PROPERTY})`,
            position: "absolute",
            // Centering stays in `transform`, so `translate` remains free for styling.
            transform: "translateX(-50%)",
          }),
        }),
        state: (state: WaveformState) => publicState(state),
      }),
    };
  },
  state: (options: WaveformPrimitiveOptions): WaveformState => {
    const view = viewOf(options);
    return {
      duration: options.duration ?? 1,
      levels: options.levels,
      loading: options.loading ?? false,
      name: options.name,
      peaks: options.peaks,
      regions: 0,
      source: options.source,
      value: view.value,
      view,
    };
  },
  sync: (options: WaveformPrimitiveOptions) => ({
    duration: options.duration ?? 1,
    levels: options.levels,
    loading: options.loading ?? false,
    name: options.name,
    peaks: options.peaks,
    source: options.source,
    ...(options.value === undefined ? {} : { value: options.value }),
  }),
});
