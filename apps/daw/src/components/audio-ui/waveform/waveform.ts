import {
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { clamp } from "@ui-sdk/core/number";
import {
  moveRange,
  normalizeRange,
  type RangeEdge,
  type RangeValue,
} from "../grid";
import {
  type ChangeDetails,
  type CommitDetails,
  createGestures,
  createReporter,
  createStore,
  definePrimitive,
  flag,
  type Source,
  type Store,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../primitive";
import { isAudible } from "./levels";
import type { WaveformIdle } from "./levels-engine";
import { attachWaveformBars } from "./paint-bars";
import { attachWaveformCanvas } from "./paint-canvas";
import type { WaveformPeaks } from "./peaks";

export type { ChangeDetails, CommitDetails } from "../primitive";
export type { WaveformIdle } from "./levels-engine";
export type { WaveformPeaks } from "./peaks";

/**
 * The waveform: a position to seek, a stretch of the audio shown, regions to
 * move and resize, and the canvas and the bars painted outside any render.
 * The press, the scrub, the keys, the Shift + drag selection and the regions
 * are the primitive's own (`waveform.ts`); the painters are beside it.
 *
 * The position reaches the DOM in one place, the Root's `bind`: the
 * `--waveform-position` CSS variable the playhead and thumb follow, the store
 * the painters read, and the input assistive technology reads. A live `source`
 * therefore paints every frame with no render.
 *
 * A region is named, by its `region` prop, and holds a value of its own.
 * What it reports goes through the Root, `onRegionChange` and
 * `onRegionCommitted`, with the region's name and the edge in the details.
 */

/** What a change to a region moves: its start, its end, or the whole region with `"both"`. */
export type WaveformRegionEdge = RangeEdge;
/** A region as `[start, end]`, in `duration` units. */
export type WaveformRegionValue = RangeValue;

const noop = () => undefined;

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
  disabled: boolean;
  /** Where a drag has taken the position, held until release so a controlled position that lags cannot pull the waveform back. */
  draft: number | null;
  /** Whether a pointer is scrubbing or selecting. */
  dragging: boolean;
  duration: number;
  largeStep: number;
  levels: LevelsSource | undefined;
  loading: boolean;
  name: string | undefined;
  peaks: WaveformPeaks | undefined;
  /** The stretch of the audio shown, `[start, end]` in `duration` units. */
  range: readonly [number, number];
  /** Counts the changes a region made, so the parts read them again. */
  regions: number;
  /** The live position the waveform follows, when it has one. */
  source: PositionSource | undefined;
  step: number;
  /** The position the app holds, or the waveform's own. */
  value: number;
}

/** What a view draws a waveform from. */
export interface WaveformView {
  disabled: boolean;
  dragging: boolean;
  duration: number;
  largeStep: number;
  loading: boolean;
  range: readonly [number, number];
  step: number;
  /** The position as displayed: the dragged one while a pointer moves it, or the live source's. */
  value: number;
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

/** What a region reads, and every way of moving it. */
export interface RegionHandle {
  /** How far an edge can go: the limits of its position, which stop short of the other edge. */
  edgeRange: (edge: WaveformRegionEdge) => readonly [number, number];
  getSnapshot: () => RegionView;
  /** Handles a key on an edge's input: arrows and Page keys move it, Home and End go to its ends. Returns whether the edge took the key. */
  keyDown: (edge: WaveformRegionEdge, event: KeyboardEvent) => boolean;
  /** Starts a drag of `edge` (or of the whole region, `"both"`) from `handle`; `track` is the element the region sits on, which turns pixels into `duration` units. */
  press: (
    edge: WaveformRegionEdge,
    event: PointerEvent,
    handle: HTMLElement,
    track: Element | null
  ) => void;
  /** Moves an edge to a position from an input. */
  typeAt: (edge: WaveformRegionEdge, position: number, event: Event) => void;
}

/** What a view draws a region from. */
export interface RegionView {
  disabled: boolean;
  dragging: boolean;
  duration: number;
  largeStep: number;
  minLength: number;
  step: number;
  /** The region as displayed: the dragged one while a pointer moves it. */
  value: WaveformRegionValue;
}

/** What a waveform's `api` gives an adapter. */
export interface WaveformApi {
  /** The nodes of the bars, by index, which the bars painter writes to. */
  bars: { minLevel: number; nodes: Map<number, HTMLElement> };
  /** How the position is announced; set by the input. */
  describe: { current: DescribeValue };
  /** The position under the pointer while it hovers, in `duration` units, or null. */
  hover: Store<number | null>;
  /** Sets the hover from a pointer over `element`. */
  hoverAt: (clientX: number, element: Element) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (value: unknown) => string };
  /** Handles a key on the seekable surface's input. Returns whether the seek took the key. */
  keyDown: (event: KeyboardEvent) => boolean;
  /** The pointer left the surface: the hover goes. */
  leave: () => void;
  /** The played share, 0 to 1, observable outside any render. */
  position: Store<number>;
  /** Starts a press on `element`: a press seeks, a drag scrubs; with Shift held and a selection listener, a drag selects a stretch instead. */
  pressSeek: (event: PointerEvent, element: HTMLElement) => void;
  /** The region named in `props`, with the latest props when they are the region part's own. */
  regionFor: (
    props: RegionProps | RegionPartProps,
    /** Whether `props` are the region part's own, which hold what the region is given. */
    owner?: boolean
  ) => RegionHandle;
  /** Sets the position from an input, reporting an `"input-change"` change and commit. */
  typeAt: (value: number, event: Event) => void;
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

/** The position the waveform shows: the dragged one, or the live source's, or the held one. */
const positionOf = (state: WaveformState) =>
  state.draft ??
  clampFinite(
    state.source ? state.source.getSnapshot() : state.value,
    0,
    state.duration
  );

/** `value` within `min` and `max`, or `min` when it is not a number. */
const clampFinite = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : min;

const views = new WeakMap<WaveformState, WaveformView>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: WaveformState): WaveformView {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const view: WaveformView = {
    disabled: state.disabled,
    dragging: state.dragging,
    duration: state.duration,
    largeStep: state.largeStep,
    loading: state.loading,
    range: state.range,
    step: state.step,
    value: positionOf(state),
  };
  views.set(state, view);
  return view;
}

/** How far across the shown stretch `value` is: 0 at its start, 1 at its end. */
function shareOf(state: WaveformState, value: number) {
  const [start, end] = state.range;
  return end > start ? (value - start) / (end - start) : 0;
}

/** The value at `share` of the way across the shown stretch. */
function atShare(state: WaveformState, share: number) {
  const [start, end] = state.range;
  return start + share * (end - start);
}

/** The state an options object asks for, with the defaults of the waveform. */
function stateOf(options: WaveformPrimitiveOptions) {
  const duration = options.duration ?? 1;
  const [start, end] = options.range
    ? normalizeRange(options.range, duration)
    : [0, duration];
  return {
    disabled: options.disabled ?? false,
    duration,
    largeStep: options.largeStep ?? duration / 10,
    levels: options.levels,
    loading: options.loading ?? false,
    name: options.name,
    peaks: options.peaks,
    range: end > start ? ([start, end] as const) : ([0, duration] as const),
    source: options.source,
    step: options.step ?? duration / 100,
  };
}

const publicState = (state: WaveformState): WaveformPublicState => ({
  disabled: state.disabled,
  dragging: state.dragging,
  loading: state.loading,
});

const stateAttrs = (state: WaveformState) => ({
  "data-disabled": flag(state.disabled),
  "data-dragging": flag(state.dragging),
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

/** One pointer gesture on the waveform: a seek, or a Shift + drag selection. */
interface SeekGesture {
  /** Where a selection began. */
  anchor: number;
  /** Whether it moved the position, or selected a stretch, at least once; if so its end commits. */
  changed: boolean;
  kind: "seek" | "select";
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  /** The stretch selected so far. */
  selected: readonly [number, number] | null;
}

/** One drag of a region or of one of its edges. */
interface RegionGesture {
  changed: boolean;
  edge: WaveformRegionEdge;
  /** The region when the pointer went down: the drag is measured from it. */
  origin: WaveformRegionValue;
  startX: number;
  /** The last region the drag applied, which its end commits. */
  value: WaveformRegionValue | null;
}

/** What the waveform keeps of one region. */
interface RegionRecord {
  dragging: boolean;
  gestures: ReturnType<typeof createGestures<RegionGesture>>;
  handle: RegionHandle;
  /** The region as the gesture under way left it: a controlled region that lags behind must not pull it back mid-drag. */
  latest: WaveformRegionValue | null;
  /** The props of the region part's newest render. */
  props: RegionProps;
  snapshot: RegionView | null;
  /** Held by the region, unless its `value` is given. */
  uncontrolled: WaveformRegionValue | undefined;
}

export const waveform: WaveformPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const { commit, report, setAtOnce, state } = createReporter(
      context,
      positionOf,
      Object.is
    );
    const set = (next: Partial<WaveformState>) =>
      context.store.set(next as never);
    const options = () => context.options() as WaveformPrimitiveOptions;
    const gestures = createGestures<SeekGesture>(context);
    const hover = createStore<number | null>(null);
    const position = createStore(shareOf(state(), positionOf(state())));
    const inert = () => state().disabled || state().loading;
    const toDuration = (value: number) =>
      clampFinite(value, 0, state().duration);
    const valueAt = (element: Element, clientX: number) => {
      const rect = element.getBoundingClientRect();
      return atShare(
        state(),
        clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
      );
    };

    /** Proposes a position during a gesture; keeps it unless refused, and says whether it was applied. */
    const moveTo = (raw: number, reason: string, event: Event) => {
      const next = toDuration(raw);
      if (next === positionOf(state()) || !report(next, reason, event)) {
        return false;
      }
      set({ draft: next });
      return true;
    };

    /** Ends a gesture, committing what it changed. */
    const finish = (gesture: SeekGesture, end: PointerEvent) => {
      if (gesture.kind === "seek") {
        // Read before settling: the position falls back to the known value after.
        const committed = positionOf(state());
        set({ dragging: false, draft: null });
        if (gesture.changed) {
          commit(committed, gesture.moved ? "drag" : "press", end);
        }
        return;
      }
      set({ dragging: false });
      if (gesture.changed && gesture.selected) {
        dispatch(context, "onSelectionCommitted", gesture.selected, {
          event: end,
          reason: "drag",
        });
      }
    };

    // ---- regions

    const records = new Map<string, RegionRecord>();
    const bump = () => set({ regions: state().regions + 1 });

    const createRecord = (name: string, props: RegionProps) => {
      const record: RegionRecord = {
        dragging: false,
        gestures: createGestures<RegionGesture>(context),
        handle: undefined as unknown as RegionHandle,
        latest: null,
        props,
        snapshot: null,
        uncontrolled: undefined,
      };
      const limits = () => ({
        duration: state().duration,
        minLength: record.props.minLength ?? state().step,
      });
      const disabled = () => state().disabled || Boolean(record.props.disabled);
      const held = (): WaveformRegionValue =>
        normalizeRange(
          record.props.value ??
            record.uncontrolled ??
            record.props.defaultValue ?? [0, state().duration],
          state().duration
        );
      const current = () => record.latest ?? held();

      /** Proposes a region; keeps it unless refused. Returns the region applied, or null. */
      const change = (
        next: WaveformRegionValue,
        edge: WaveformRegionEdge,
        reason: string,
        event: Event
      ) => {
        const [start, end] = current();
        if (next[0] === start && next[1] === end) {
          return null;
        }
        const source = sourceOf(event);
        const canceled = dispatch(context, "onRegionChange", next, {
          edge,
          event,
          reason,
          region: name,
          ...(source ? { source } : {}),
        });
        if (canceled) {
          return null;
        }
        record.latest = next;
        if (record.props.value === undefined) {
          record.uncontrolled = next;
        }
        bump();
        return next;
      };
      // A commit reports the region just applied: the region may have been
      // drawn again, from props that lag, before it is made.
      const commitRegion = (
        value: WaveformRegionValue,
        edge: WaveformRegionEdge,
        reason: string,
        event: Event
      ) =>
        dispatch(context, "onRegionCommitted", value, {
          edge,
          event,
          reason,
          region: name,
        });
      const settle = (
        next: WaveformRegionValue,
        edge: WaveformRegionEdge,
        reason: string,
        event: Event
      ) => {
        const applied = change(next, edge, reason, event);
        if (applied) {
          commitRegion(applied, edge, reason, event);
        }
      };

      /** The region with `edge` moved to `position`, measured from the region as it is now, within its limits. */
      const withEdgeAt = (edge: WaveformRegionEdge, target: number) => {
        const now = current();
        return moveRange(
          now,
          edge,
          target - (edge === "start" ? now[0] : now[1]),
          limits()
        );
      };
      const edgeRange = (edge: WaveformRegionEdge) => {
        const [start, end] = current();
        const { duration } = state();
        const { minLength } = limits();
        return edge === "start"
          ? ([0, Math.max(0, end - minLength)] as const)
          : ([Math.min(duration, start + minLength), duration] as const);
      };
      const finishRegion = (gesture: RegionGesture, end: PointerEvent) => {
        record.dragging = false;
        record.latest = null;
        bump();
        if (gesture.changed && gesture.value) {
          commitRegion(gesture.value, gesture.edge, "drag", end);
        }
      };

      record.handle = {
        edgeRange,
        getSnapshot: () => {
          const now = state();
          const next: RegionView = {
            disabled: disabled(),
            dragging: record.dragging,
            duration: now.duration,
            largeStep: now.largeStep,
            minLength: limits().minLength,
            step: now.step,
            value: record.dragging && record.latest ? record.latest : held(),
          };
          const known = record.snapshot;
          if (
            known &&
            known.value[0] === next.value[0] &&
            known.value[1] === next.value[1] &&
            known.disabled === next.disabled &&
            known.dragging === next.dragging &&
            known.duration === next.duration &&
            known.largeStep === next.largeStep &&
            known.minLength === next.minLength &&
            known.step === next.step
          ) {
            return known;
          }
          record.snapshot = next;
          return next;
        },
        keyDown: (edge, event) => {
          if (disabled()) {
            return false;
          }
          const [min, max] = edgeRange(edge);
          const now = current();
          const at = edge === "start" ? now[0] : now[1];
          const { largeStep, step } = state();
          const arrowStep = event.shiftKey ? largeStep : step;
          const target = {
            ArrowDown: at - arrowStep,
            ArrowLeft: at - arrowStep,
            ArrowRight: at + arrowStep,
            ArrowUp: at + arrowStep,
            End: max,
            Home: min,
            PageDown: at - largeStep,
            PageUp: at + largeStep,
          }[event.key];
          if (target === undefined) {
            return false;
          }
          settle(withEdgeAt(edge, target), edge, "keyboard", event);
          return true;
        },
        press: (edge, event, handle, track) => {
          if (
            disabled() ||
            event.button !== 0 ||
            !record.gestures.accepts(event, (stale) =>
              finishRegion(stale, event)
            )
          ) {
            return;
          }
          const gesture: RegionGesture = {
            changed: false,
            edge,
            origin: current(),
            startX: event.clientX,
            value: null,
          };
          record.dragging = true;
          bump();
          // Pixels become `duration` units by the stretch shown, over the track it sits on.
          const unitsPerPixel = () => {
            const width = track?.getBoundingClientRect().width ?? 0;
            const [from, to] = state().range;
            return (to - from) / Math.max(width, 1);
          };
          record.gestures.start(handle, event, gesture, {
            onEnd: (end) => finishRegion(gesture, end),
            onMove: (move) => {
              const delta = (move.clientX - gesture.startX) * unitsPerPixel();
              const applied = change(
                moveRange(gesture.origin, edge, delta, limits()),
                edge,
                "drag",
                move
              );
              if (applied) {
                gesture.changed = true;
                gesture.value = applied;
              }
            },
          });
        },
        typeAt: (edge, at, event) => {
          if (!state().disabled) {
            settle(withEdgeAt(edge, at), edge, "input-change", event);
          }
        },
      };
      return record;
    };

    return {
      bars: { minLevel: 0.08, nodes: new Map<number, HTMLElement>() },
      describe: { current: describeAsPercent },
      hover,
      hoverAt: (clientX: number, element: Element) => {
        if (!inert()) {
          hover.set(valueAt(element, clientX));
        }
      },
      internal: { keyOf: (value: unknown) => String(value) },
      keyDown: (event: KeyboardEvent) => {
        if (inert()) {
          return false;
        }
        const now = positionOf(state());
        const [start, end] = state().range;
        const { largeStep, step } = state();
        const arrowStep = event.shiftKey ? largeStep : step;
        const target = {
          ArrowDown: now - arrowStep,
          ArrowLeft: now - arrowStep,
          ArrowRight: now + arrowStep,
          ArrowUp: now + arrowStep,
          End: end,
          Home: start,
          PageDown: now - largeStep,
          PageUp: now + largeStep,
        }[event.key];
        if (target === undefined) {
          return false;
        }
        // The keys move within the stretch shown.
        setAtOnce(toDuration(clamp(target, start, end)), "keyboard", event);
        return true;
      },
      leave: () => hover.set(null),
      position,
      pressSeek: (event: PointerEvent, element: HTMLElement) => {
        if (
          inert() ||
          event.button !== 0 ||
          !gestures.accepts(event, (stale) => finish(stale, event))
        ) {
          return;
        }
        const gesture: SeekGesture = {
          anchor: 0,
          changed: false,
          kind: "seek",
          moved: false,
          selected: null,
        };
        // Shift selects a stretch, as in an audio editor, when the app listens for it; a plain press seeks.
        if (event.shiftKey && options().onSelectionChange) {
          gesture.kind = "select";
          gesture.anchor = valueAt(element, event.clientX);
          set({ dragging: true });
          gestures.start(element, event, gesture, {
            onEnd: (end) => finish(gesture, end),
            onMove: (move) => {
              const at = valueAt(element, move.clientX);
              const range = [
                Math.min(gesture.anchor, at),
                Math.max(gesture.anchor, at),
              ] as const;
              const canceled = dispatch(context, "onSelectionChange", range, {
                event: move,
                reason: "drag",
              });
              if (!canceled) {
                gesture.changed = true;
                gesture.selected = range;
              }
            },
          });
          return;
        }
        set({ dragging: true });
        gesture.changed = moveTo(
          valueAt(element, event.clientX),
          "press",
          event
        );
        gestures.start(element, event, gesture, {
          onEnd: (end) => finish(gesture, end),
          onMove: (move) => {
            gesture.moved = true;
            if (moveTo(valueAt(element, move.clientX), "drag", move)) {
              gesture.changed = true;
            }
          },
        });
      },
      regionFor: (props: RegionProps | RegionPartProps, owner = false) => {
        const name = String(props.region);
        let record = records.get(name);
        if (!record) {
          record = createRecord(name, props as RegionProps);
          records.set(name, record);
        } else if (owner) {
          // The region is told the props of its newest render.
          record.props = props as RegionProps;
          if (!record.dragging) {
            record.latest = null;
          }
        }
        return record.handle;
      },
      typeAt: (value: number, event: Event) => {
        if (!inert()) {
          setAtOnce(toDuration(value), "input-change", event);
        }
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
    const regionState = (api: WaveformApi, props: object) =>
      api.regionFor(props as RegionProps).getSnapshot();

    const edgeSlot = (edge: "end" | "start") =>
      slot<RegionPartProps, RegionPublicState>({
        attrs: (_state: WaveformState, { api, props }) => {
          const view = regionState(api, props);
          return {
            "data-disabled": flag(view.disabled),
            "data-dragging": flag(view.dragging),
            "data-edge": edge,
            "data-region": String(props.region),
            style: css({ "touch-action": "none" }),
          };
        },
        on: {
          pointerdown: (event, { api, el, props }) => {
            if (event.button !== 0) {
              return;
            }
            // The press stops here, so the control underneath takes no seek.
            event.stopPropagation();
            const handle = api.regionFor(props);
            if (!el || handle.getSnapshot().disabled) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            const regionEl = el.closest<HTMLElement>(
              '[data-slot="waveform-region"]'
            );
            handle.press(edge, event, el, trackOf(regionEl));
          },
        },
        props: { getAriaValueText: "value", region: "key" },
        state: (state: WaveformState, { api, props }) => ({
          ...publicState(state),
          value: regionState(api, props).value,
        }),
      });

    const edgeInputSlot = (edge: "end" | "start") =>
      slot<RegionPartProps>({
        attrs: (state: WaveformState, { api, props }) => {
          const handle = api.regionFor(props);
          const view = handle.getSnapshot();
          const current = edge === "start" ? view.value[0] : view.value[1];
          const [min, max] = handle.edgeRange(edge);
          return {
            "aria-valuetext": (props.getAriaValueText ?? describeAsPercent)(
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
          change: (event, { api, el, props }) =>
            api
              .regionFor(props)
              .typeAt(edge, Number((el as HTMLInputElement).value), event),
          keydown: (event, { api, props }) => {
            if (api.regionFor(props).keyDown(edge, event)) {
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
                state.range[0],
                state.range[1],
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
                  range: state.range,
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
                state.range[0],
                state.range[1],
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
                range: state.range,
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
            const now = store.get();
            if (!el || now.disabled || now.loading || event.button !== 0) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            api.pressSeek(event, el);
          },
          pointerleave: (_event, { api }) => api.leave(),
          pointermove: (event, { api, el, store }) => {
            if (!el || store.get().disabled || store.get().loading) {
              return;
            }
            api.hoverAt(event.clientX, el);
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
            const hovered = part.api.hover.get();
            const state = part.store.get();
            const shown =
              hovered !== null && !(state.disabled || state.loading);
            el.toggleAttribute("hidden", !shown);
            if (!shown) {
              return;
            }
            el.style.left = percentOf(shareOf(state, hovered));
            const next = part.props.format?.(hovered) ?? "";
            if (text.nodeValue !== next) {
              text.nodeValue = next;
            }
          };
          paint();
          const off = part.api.hover.subscribe(paint);
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
              viewOf(state).value,
              state.duration
            ),
            disabled: flag(state.disabled),
            max: String(state.range[1]),
            min: String(state.range[0]),
            name: state.name,
            step: "any",
            style: css(VISUALLY_HIDDEN),
            type: "range",
            value: String(viewOf(state).value),
          };
        },
        on: {
          change: (event, { api, el }) =>
            api.typeAt(Number((el as HTMLInputElement).value), event),
          keydown: (event, { api }) => {
            if (api.keyDown(event)) {
              event.preventDefault();
            }
          },
        },
        props: { getAriaValueText: "value" },
      }),
      marker: slot<{ value: number }, WaveformPublicState>({
        attrs: (state: WaveformState, { props }) => ({
          ...stateAttrs(state),
          style: css({
            left: percentOf(
              shareOf(
                state,
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
          const view = api.regionFor(props as RegionProps, true).getSnapshot();
          const [from, to] = state.range;
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
          pointerdown: (event, { api, el, props }) => {
            if (event.button !== 0) {
              return;
            }
            event.stopPropagation();
            const handle = api.regionFor(props, true);
            if (
              !el ||
              props.movable === false ||
              handle.getSnapshot().disabled
            ) {
              return;
            }
            event.preventDefault();
            handle.press("both", event, el, trackOf(el));
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
          value: regionState(api, props).value,
        }),
      }),
      regionEnd: edgeSlot("end"),
      regionEndInput: edgeInputSlot("end"),
      regionStart: edgeSlot("start"),
      regionStartInput: edgeInputSlot("start"),
      root: slot<object, WaveformPublicState>({
        attrs: (state: WaveformState) => ({
          ...stateAttrs(state),
          style: css({
            [POSITION_PROPERTY]: percentOf(shareOf(state, viewOf(state).value)),
          }),
        }),
        // The single place a position reaches the DOM, outside any render.
        bind: (el, part) => {
          const { position } = part.api;
          const paint = () => {
            const now = part.store.get();
            const { duration } = now;
            const next = clampFinite(positionOf(now), 0, duration);
            const share = shareOf(now, next);
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
              "data-selected",
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
          const offStore = part.store.subscribe(watch);
          return () => {
            offStore();
            unfollow();
            unhear();
            el.removeAttribute("data-selected");
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
  state: (options: WaveformPrimitiveOptions): WaveformState => ({
    ...stateOf(options),
    draft: null,
    dragging: false,
    regions: 0,
    value: options.value ?? options.defaultValue ?? 0,
  }),
  sync: (options: WaveformPrimitiveOptions) => ({
    ...stateOf(options),
    ...(options.value === undefined ? {} : { value: options.value }),
  }),
});