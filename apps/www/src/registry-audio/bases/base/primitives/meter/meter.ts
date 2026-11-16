import {
  css,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { numberFormatter } from "@ui-sdk/core/number";
import { definePrimitive, flag } from "../primitive";

/**
 * The meter. Levels arrive two ways: as `value` (and `peak`), arrays the app
 * renders, which the server writes too; or from a live `source` an engine
 * pushes to every frame. A source is painted straight onto the elements of
 * each channel, from one subscription for all the channels, so a signal
 * updating 60 times a second never renders the framework.
 *
 * A channel is keyed by its `index`, as the kernel keys the items of a
 * collection: the indicator, the peak, the value and the label inside it take
 * the index from it.
 */

/** Which way a meter's bars run. */
export type MeterOrientation = "horizontal" | "vertical";

/** One reading of the meter: a level per channel, and optionally a peak-hold level per channel. */
export interface MeterFrame {
  levels: readonly number[];
  peaks?: readonly number[] | undefined;
}

/** A live frame an engine pushes to: what it holds now, and a way to hear it change. */
export interface MeterSource {
  getSnapshot: () => MeterFrame;
  subscribe: (listener: () => void) => () => void;
}

/** A custom curve: any increasing function of the level, rescaled to the meter's range. */
export type LevelScaleFunction = (level: number) => number;

/**
 * How a level in dB is spread along the meter's length: evenly, the way
 * digital peak meters spread it, with room at the top where it matters, or a
 * curve of your own.
 */
export type LevelScale = "iec" | "linear" | LevelScaleFunction;

/** Levels read to one decimal: finer than a meter can be read, and a plain number rather than a share of the range. */
const DEFAULT_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

/**
 * The deflection of an IEC 60268-18 style digital peak meter, from 0 at
 * -70 dB to 100 at 0 dB: each stretch of the scale gets more room than the
 * one below, so the top 20 dB take half the length.
 */
function iecDeflection(level: number): number {
  if (level < -70) {
    return 0;
  }
  if (level < -60) {
    return (level + 70) * 0.25;
  }
  if (level < -50) {
    return (level + 60) * 0.5 + 2.5;
  }
  if (level < -40) {
    return (level + 50) * 0.75 + 7.5;
  }
  if (level < -30) {
    return (level + 40) * 1.5 + 15;
  }
  if (level < -20) {
    return (level + 30) * 2 + 30;
  }
  return (level + 20) * 2.5 + 50;
}

/** A function from a level to its position along the length, 0 at `min` and 1 at `max`. */
function levelPosition(scale: LevelScale, min: number, max: number) {
  let curve: LevelScaleFunction;
  if (scale === "iec") {
    curve = iecDeflection;
  } else if (scale === "linear") {
    curve = (level) => level;
  } else {
    curve = scale;
  }
  const low = curve(min);
  const span = curve(max) - low || 1;
  return (level: number) =>
    Math.min(1, Math.max(0, (curve(level) - low) / span));
}

export interface MeterPrimitiveOptions {
  /** Level at or above which a channel is clipping. @default 0 */
  clipThreshold?: number;
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  /** @default 6 */
  max?: number;
  /** @default -60 */
  min?: number;
  /** @default "vertical" */
  orientation?: MeterOrientation;
  /** Peak-hold level per channel. */
  peak?: readonly number[];
  /** How levels are spread along the length. @default "linear" */
  scale?: LevelScale;
  /** A live frame an engine pushes to, painted without a render. */
  source?: MeterSource;
  /** Level per channel; the array length is the channel count. */
  value?: readonly number[];
  /** Level at or above which a channel is in its warning zone. Unset, there is none. */
  warnThreshold?: number;
}

/** The range, the warning and clipping levels, the position of a level along the meter, and how a level is written. */
export interface MeterConfig {
  clipThreshold: number;
  formatter: Intl.NumberFormat;
  max: number;
  min: number;
  /** A level's position along the length, 0 to 1. */
  position: (level: number) => number;
  warnThreshold: number;
}

export interface MeterState {
  channelCount: number;
  config: MeterConfig;
  /** The frame the parts render, before any live one: the app's, or the source's current. */
  frame: MeterFrame;
  /** The channels that have a label part, by index. */
  labelled: readonly number[];
  orientation: MeterOrientation;
  source: MeterSource | undefined;
}

function configOf(options: MeterPrimitiveOptions): MeterConfig {
  const min = options.min ?? -60;
  const max = options.max ?? 6;
  return {
    clipThreshold: options.clipThreshold ?? 0,
    formatter: numberFormatter(
      options.locale as string | undefined,
      options.format ?? DEFAULT_FORMAT
    ),
    max,
    min,
    position: levelPosition(options.scale ?? "linear", min, max),
    warnThreshold: options.warnThreshold ?? Number.POSITIVE_INFINITY,
  };
}

const frameOf = (options: MeterPrimitiveOptions): MeterFrame =>
  options.source
    ? options.source.getSnapshot()
    : { levels: options.value ?? [], peaks: options.peak };

function stateOf(options: MeterPrimitiveOptions): MeterState {
  const frame = frameOf(options);
  return {
    channelCount: frame.levels.length,
    config: configOf(options),
    frame,
    labelled: [],
    orientation: options.orientation ?? "vertical",
    source: options.source,
  };
}

/** What one channel shows for a level. */
export interface MeterChannelView {
  clipping: boolean;
  /** Peak mark position, 0 to 1; undefined when there is no peak for the channel. */
  peakPercent: number | undefined;
  /** Indicator length, 0 to 1. */
  percent: number;
  text: string;
  valueNow: number;
  /** At or above the warning level, and not yet clipping. */
  warning: boolean;
}

/** What channel `index` shows for its reading in `frame`, the state's own unless given: its bar, its peak mark, whether it warns or clips, its text. */
export function channelView(
  state: MeterState,
  index: number,
  frame: MeterFrame = state.frame
): MeterChannelView {
  const { clipThreshold, formatter, min, position, warnThreshold } =
    state.config;
  const level = frame.levels[index] ?? min;
  const peak = frame.peaks?.[index];
  // One decimal keeps a live signal from rewriting the attribute every frame.
  const valueNow = Math.round(level * 10) / 10;
  return {
    clipping: level >= clipThreshold,
    peakPercent: peak === undefined ? undefined : position(peak),
    percent: position(level),
    text: formatter.format(valueNow),
    valueNow,
    warning: level >= warnThreshold && level < clipThreshold,
  };
}

/** The DOM nodes of one channel that a live source writes to. */
interface ChannelNodes {
  channel?: HTMLElement;
  getAriaValueText?: (
    formattedValue: string,
    value: number,
    index: number
  ) => string;
  indicator?: HTMLElement;
  peak?: HTMLElement;
  value?: HTMLElement;
}

/** Sets `attribute` on `node` as an empty attribute, or removes it. */
function setPresence(node: Element, attribute: string, present: boolean) {
  if (present) {
    node.setAttribute(attribute, "");
  } else {
    node.removeAttribute(attribute);
  }
}

/** Writes the level's text into the value part's first text node, which the framework made. */
function writeText(part: HTMLElement, text: string) {
  for (const child of part.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.nodeValue !== text) {
        child.nodeValue = text;
      }
      return;
    }
  }
  part.appendChild(document.createTextNode(text));
}

/** Writes one channel's view straight to its nodes, touching only what changed. */
function paintChannel(
  nodes: ChannelNodes,
  view: MeterChannelView,
  index: number,
  orientation: MeterOrientation
) {
  const { channel, indicator, peak, value } = nodes;
  if (indicator) {
    indicator.style.transform =
      orientation === "horizontal"
        ? `scaleX(${view.percent})`
        : `scaleY(${view.percent})`;
    setPresence(indicator, "data-clipping", view.clipping);
    setPresence(indicator, "data-warning", view.warning);
    // Latched: it stays until a click on the meter clears it.
    if (view.clipping) {
      setPresence(indicator, "data-clipped", true);
    }
  }
  if (peak) {
    peak.hidden = view.peakPercent === undefined;
    if (view.peakPercent !== undefined) {
      peak.style[orientation === "horizontal" ? "left" : "bottom"] =
        `${view.peakPercent * 100}%`;
    }
  }
  if (channel) {
    const valueNow = String(view.valueNow);
    if (channel.getAttribute("aria-valuenow") !== valueNow) {
      channel.setAttribute("aria-valuenow", valueNow);
      channel.setAttribute(
        "aria-valuetext",
        nodes.getAriaValueText?.(view.text, view.valueNow, index) ?? view.text
      );
    }
    setPresence(channel, "data-clipping", view.clipping);
    setPresence(channel, "data-warning", view.warning);
    if (view.clipping) {
      setPresence(channel, "data-clipped", true);
    }
  }
  if (value) {
    writeText(value, view.text);
  }
}

const SLOT = (name: string) => `[data-slot="meter-${name}"]`;

/**
 * Finds the parts of a channel a live source writes to. A framework that binds
 * a parent before its children, as custom elements do, has not marked them
 * yet when the channel binds, so what is missing is looked for again.
 */
function resolve(nodes: ChannelNodes) {
  const { channel } = nodes;
  if (channel) {
    nodes.indicator ??=
      channel.querySelector<HTMLElement>(SLOT("indicator")) ?? undefined;
    nodes.peak ??=
      channel.querySelector<HTMLElement>(SLOT("peak")) ?? undefined;
    nodes.value ??=
      channel.querySelector<HTMLElement>(SLOT("value")) ?? undefined;
  }
  return nodes;
}

/** What a part's className, style and children functions read of the meter. */
export interface MeterPublicState {
  channelCount: number;
  orientation: MeterOrientation;
}

/** What a channel and the parts inside it read of their channel. */
export interface ChannelPublicState {
  /** Whether the level is at or above the clip threshold. */
  clipping: boolean;
  index: number;
  orientation: MeterOrientation;
  /** The level as text, with `format` and `locale`. */
  text: string;
  /** The level, to one decimal. */
  valueNow: number;
  /** Whether the level is at or above the warning level, below the clip threshold. */
  warning: boolean;
}

/** The channel's view as the state its parts read. */
function channelState(state: MeterState, index: number): ChannelPublicState {
  const view = channelView(state, index);
  return {
    clipping: view.clipping,
    index,
    orientation: state.orientation,
    text: view.text,
    valueNow: view.valueNow,
    warning: view.warning,
  };
}

/** The attributes every part of a channel carries. */
const channelAttrs = (channel: ChannelPublicState) => ({
  "data-clipping": flag(channel.clipping),
  "data-orientation": channel.orientation,
  "data-warning": flag(channel.warning),
});

/** What a meter's `api` gives an adapter. */
export interface MeterApi {
  /** The nodes of each channel a live source is painted onto. */
  channels: Map<number, ChannelNodes>;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (index: unknown) => string };
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a part inside a channel: the channel's index, which it inherits. */
interface InChannel extends PartProps {
  index?: number;
}

/** The meter's slots, by name, with the props and the public state of each. */
export type MeterSlots = {
  channel: SlotDefinition<
    MeterState,
    MeterApi,
    PartProps & {
      getAriaValueText?: (
        formatted: string,
        value: number,
        index: number
      ) => string;
      index: number;
    },
    ChannelPublicState
  >;
  indicator: SlotDefinition<
    MeterState,
    MeterApi,
    InChannel,
    ChannelPublicState
  >;
  label: SlotDefinition<MeterState, MeterApi, InChannel, object>;
  mark: SlotDefinition<
    MeterState,
    MeterApi,
    PartProps & { value: number },
    MeterPublicState
  >;
  peak: SlotDefinition<MeterState, MeterApi, InChannel, ChannelPublicState>;
  root: SlotDefinition<MeterState, MeterApi, PartProps, MeterPublicState>;
  track: SlotDefinition<MeterState, MeterApi, PartProps, object>;
  value: SlotDefinition<MeterState, MeterApi, InChannel, ChannelPublicState>;
};

/**
 * The type of `meter`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface MeterPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: MeterSlots;
  (
    initialOptions: MeterPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: MeterApi;
    get: () => MeterState;
    types: {
      api: MeterApi;
      options: MeterPrimitiveOptions;
      slots: MeterSlots;
      state: MeterState;
    };
  };
}

/**
 * What a part inside a channel takes from it: its index, and the same index
 * as `value`, which the kernel keys a part by, so the labels (and the other
 * parts) of two channels are two parts and not one.
 */
const IN_CHANNEL = {
  index: { from: "channel", kind: "number", required: true },
  value: { from: "channel.index", kind: "number" },
} as const;

/** The index of a part inside a channel, which it inherits as the key's text. */
const indexOf = (props: InChannel) => Number(props.index ?? 0);

const noop = () => undefined;

export const meter: MeterPrimitive = definePrimitive({
  api: () => ({
    channels: new Map<number, ChannelNodes>(),
    internal: { keyOf: (index: unknown) => String(index) },
  }),
  name: "meter",
  options: {
    clipThreshold: "number",
    format: "value",
    locale: "value",
    max: "number",
    min: "number",
    orientation: "string",
    peak: "value",
    scale: "value",
    source: "value",
    value: "value",
    warnThreshold: "number",
  },
  slots: (slot) => ({
    channel: slot<
      {
        getAriaValueText?: (
          formatted: string,
          value: number,
          index: number
        ) => string;
        index: number;
      },
      ChannelPublicState
    >({
      attrs: (state: MeterState, { id, props }) => {
        // An index written as an attribute comes as text.
        const index = Number(props.index);
        const view = channelView(state, index);
        const { max, min } = state.config;
        return {
          ...channelAttrs(channelState(state, index)),
          "aria-labelledby": state.labelled.includes(index)
            ? `${id}-label-${index}`
            : undefined,
          "aria-valuemax": String(max),
          "aria-valuemin": String(min),
          "aria-valuenow": String(Math.min(max, Math.max(min, view.valueNow))),
          "aria-valuetext":
            props.getAriaValueText?.(view.text, view.valueNow, index) ??
            view.text,
          role: "meter",
          style: css({ position: "relative" }),
        };
      },
      // A live source paints the channel's elements itself, from the root's one subscription.
      bind: (el, part) => {
        const index = Number(part.props.index);
        const nodes: ChannelNodes = {
          channel: el,
          getAriaValueText: part.props.getAriaValueText,
        };
        part.api.channels.set(index, nodes);
        const state = part.store.get();
        if (state.source) {
          const view = channelView(state, index, state.source.getSnapshot());
          paintChannel(resolve(nodes), view, index, state.orientation);
        }
        return () => part.api.channels.delete(index);
      },
      // A formatter, read for its result: "callback" would make it an event in Vue.
      props: { getAriaValueText: "value", index: "key" },
      state: (state: MeterState, { props }) =>
        channelState(state, Number(props.index)),
    }),
    indicator: slot<InChannel, ChannelPublicState>({
      attrs: (state: MeterState, { props }) => {
        const index = indexOf(props);
        const { percent } = channelView(state, index);
        const horizontal = state.orientation === "horizontal";
        return {
          ...channelAttrs(channelState(state, index)),
          "aria-hidden": "true",
          style: css({
            height: "100%",
            "inset-inline-start": "0",
            transform: horizontal ? `scaleX(${percent})` : `scaleY(${percent})`,
            "transform-origin": horizontal ? "left center" : "center bottom",
            width: "100%",
            "will-change": "transform",
          }),
        };
      },
      props: IN_CHANNEL,
      state: (state: MeterState, { props }) =>
        channelState(state, indexOf(props)),
    }),
    label: slot<InChannel>({
      attrs: (_state: MeterState, { id, props }) => ({
        id: `${id}-label-${indexOf(props)}`,
        role: "presentation",
      }),
      bind: (_el, part) => {
        const index = indexOf(part.props);
        part.store.set({ labelled: [...part.store.get().labelled, index] });
        return () =>
          part.store.set({
            labelled: part.store
              .get()
              .labelled.filter((each) => each !== index),
          });
      },
      props: IN_CHANNEL,
    }),
    mark: slot<{ value: number }, MeterPublicState>({
      attrs: (state: MeterState, { props }) => {
        const at = state.config.position(props.value) * 100;
        return {
          "aria-hidden": "true",
          "data-orientation": state.orientation,
          style: css({
            position: "absolute",
            ...(state.orientation === "vertical"
              ? { bottom: `${at}%` }
              : { "inset-inline-start": `${at}%` }),
          }),
        };
      },
      props: { value: "number" },
      state: (state: MeterState) => ({
        channelCount: state.channelCount,
        orientation: state.orientation,
      }),
    }),
    peak: slot<InChannel, ChannelPublicState>({
      attrs: (state: MeterState, { props }) => {
        const index = indexOf(props);
        const { peakPercent } = channelView(state, index);
        const at = `${(peakPercent ?? 0) * 100}%`;
        return {
          ...channelAttrs(channelState(state, index)),
          "aria-hidden": "true",
          hidden: peakPercent === undefined ? "" : undefined,
          style: css(
            state.orientation === "horizontal" ? { left: at } : { bottom: at }
          ),
        };
      },
      props: IN_CHANNEL,
      state: (state: MeterState, { props }) =>
        channelState(state, indexOf(props)),
    }),
    root: slot<object, MeterPublicState>({
      attrs: (state: MeterState) => ({
        "data-orientation": state.orientation,
        role: "group",
      }),
      // One subscription paints every channel of a live source.
      bind: (_el, part) => {
        let watched: MeterSource | undefined;
        let stop: () => void = noop;
        const paint = () => {
          const state = part.store.get();
          if (!state.source) {
            return;
          }
          const frame = state.source.getSnapshot();
          if (frame.levels.length !== state.channelCount) {
            part.store.set({ channelCount: frame.levels.length });
          }
          for (const [index, nodes] of part.api.channels) {
            if (index < frame.levels.length) {
              paintChannel(
                resolve(nodes),
                channelView(state, index, frame),
                index,
                state.orientation
              );
            }
          }
        };
        const watch = () => {
          const { source } = part.store.get();
          if (source !== watched) {
            stop();
            watched = source;
            stop = source ? source.subscribe(paint) : noop;
          }
          paint();
        };
        watch();
        const off = part.store.subscribe(watch);
        return () => {
          off();
          stop();
        };
      },
      on: {
        // A click anywhere on the meter clears what a live source latched, as in a DAW.
        click: (_event, { el }) => {
          for (const node of el?.querySelectorAll("[data-clipped]") ?? []) {
            setPresence(node, "data-clipped", false);
          }
        },
      },
      state: (state: MeterState) => ({
        channelCount: state.channelCount,
        orientation: state.orientation,
      }),
    }),
    track: slot({ attrs: () => ({}) }),
    value: slot<InChannel, ChannelPublicState>({
      attrs: () => ({ "aria-hidden": "true" }),
      props: IN_CHANNEL,
      state: (state: MeterState, { props }) =>
        channelState(state, indexOf(props)),
    }),
  }),
  state: stateOf,
  // What the options give, not what the parts registered: the labels stay.
  sync: (options: MeterPrimitiveOptions) => {
    const { labelled: _labelled, ...held } = stateOf(options);
    return held;
  },
});
