import type { Source } from "@audio-ui/core";
import {
  channelView,
  createMeterConfig,
  type LevelScale,
  type MeterChannelNodes,
  type MeterConfig,
  type MeterFrame,
  type MeterOrientation,
  paintChannel,
  setPresence,
} from "@audio-ui/core/meter";
import {
  css,
  definePrimitive,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { flag } from "../shared.ts";

/**
 * The meter as a UI SDK primitive. Levels arrive two ways: as `value` (and
 * `peak`), arrays the app renders, which the server writes too; or from a live
 * `source` an engine pushes to every frame. A source is painted straight onto
 * the elements of each channel by our `paintChannel`, from one subscription
 * for all the channels, so a signal updating 60 times a second never renders
 * the framework.
 *
 * A channel is keyed by its `index`, as UI SDK keys the items of a
 * collection: the indicator, the peak, the value and the label inside it take
 * the index from it.
 */

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
  source?: Source<MeterFrame>;
  /** Level per channel; the array length is the channel count. */
  value?: readonly number[];
  /** Level at or above which a channel is in its warning zone. Unset, there is none. */
  warnThreshold?: number;
}

export interface MeterState {
  channelCount: number;
  config: MeterConfig;
  /** The frame the parts render, before any live one: the app's, or the source's current. */
  frame: MeterFrame;
  /** The channels that have a label part, by index. */
  labelled: readonly number[];
  orientation: MeterOrientation;
  source: Source<MeterFrame> | undefined;
}

const configOf = (options: MeterPrimitiveOptions) =>
  createMeterConfig({
    clipThreshold: options.clipThreshold,
    format: options.format,
    locale: options.locale,
    max: options.max,
    min: options.min,
    scale: options.scale,
    warnThreshold: options.warnThreshold,
  });

const frameOf = (options: MeterPrimitiveOptions): MeterFrame =>
  options.source
    ? options.source.getSnapshot()
    : { levels: options.value ?? [], peaks: options.peak };

const stateOf = (options: MeterPrimitiveOptions): MeterState => {
  const frame = frameOf(options);
  return {
    channelCount: frame.levels.length,
    config: configOf(options),
    frame,
    labelled: [],
    orientation: options.orientation ?? "vertical",
    source: options.source,
  };
};

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

/** What a meter's `api` gives an adapter. */
export interface MeterApi {
  /** The nodes of each channel a live source is painted onto. */
  channels: Map<number, MeterChannelNodes>;
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

const SLOT = (name: string) => `[data-slot="meter-${name}"]`;

/**
 * Finds the parts of a channel a live source writes to. A framework that binds
 * a parent before its children, as custom elements do, has not marked them
 * yet when the channel binds, so what is missing is looked for again.
 */
function resolve(nodes: MeterChannelNodes) {
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

/** The channel's view as the state its parts read. */
function channelState(state: MeterState, index: number): ChannelPublicState {
  const view = channelView(state.frame, index, state.config);
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

export const meter: MeterPrimitive = definePrimitive({
  api: () => ({
    channels: new Map<number, MeterChannelNodes>(),
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
        const view = channelView(state.frame, index, state.config);
        const { max, min } = state.config;
        const channel = channelState(state, index);
        return {
          ...channelAttrs(channel),
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
        const nodes: MeterChannelNodes = {
          channel: el,
          getAriaValueText: part.props.getAriaValueText,
        };
        part.api.channels.set(index, nodes);
        const { source } = part.store.get();
        if (source) {
          resolve(nodes);
          const state = part.store.get();
          const frame = source.getSnapshot();
          const view = channelView(frame, index, state.config);
          paintChannel(
            { ...nodes, value: undefined },
            view,
            index,
            state.orientation
          );
          if (nodes.value) {
            writeText(nodes.value, view.text);
          }
        }
        return () => part.api.channels.delete(index);
      },
      props: { getAriaValueText: "value", index: "key" },
      state: (state: MeterState, { props }) =>
        channelState(state, Number(props.index)),
    }),
    indicator: slot<InChannel, ChannelPublicState>({
      attrs: (state: MeterState, { props }) => {
        const index = Number(props.index ?? 0);
        const channel = channelState(state, index);
        const view = channelView(state.frame, index, state.config);
        const horizontal = state.orientation === "horizontal";
        return {
          ...channelAttrs(channel),
          "aria-hidden": "true",
          style: css({
            height: "100%",
            "inset-inline-start": "0",
            transform: horizontal
              ? `scaleX(${view.percent})`
              : `scaleY(${view.percent})`,
            "transform-origin": horizontal ? "left center" : "center bottom",
            width: "100%",
            "will-change": "transform",
          }),
        };
      },
      props: { index: { from: "channel", kind: "number", required: true } },
      state: (state: MeterState, { props }) =>
        channelState(state, Number(props.index ?? 0)),
    }),
    label: slot<InChannel>({
      attrs: (_state: MeterState, { id, props }) => ({
        id: `${id}-label-${Number(props.index ?? 0)}`,
        role: "presentation",
      }),
      bind: (_el, part) => {
        // An index a part inherits from its channel comes as the key text.
        const index = Number(part.props.index ?? 0);
        part.store.set({ labelled: [...part.store.get().labelled, index] });
        return () =>
          part.store.set({
            labelled: part.store
              .get()
              .labelled.filter((each) => each !== index),
          });
      },
      props: { index: { from: "channel", kind: "number", required: true } },
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
        const index = Number(props.index ?? 0);
        const channel = channelState(state, index);
        const { peakPercent } = channelView(state.frame, index, state.config);
        const at = `${(peakPercent ?? 0) * 100}%`;
        return {
          ...channelAttrs(channel),
          "aria-hidden": "true",
          hidden: peakPercent === undefined ? "" : undefined,
          style: css(
            state.orientation === "horizontal" ? { left: at } : { bottom: at }
          ),
        };
      },
      props: { index: { from: "channel", kind: "number", required: true } },
      state: (state: MeterState, { props }) =>
        channelState(state, Number(props.index ?? 0)),
    }),
    root: slot<object, MeterPublicState>({
      attrs: (state: MeterState) => ({
        "data-orientation": state.orientation,
        role: "group",
      }),
      // One subscription paints every channel of a live source.
      bind: (el, part) => {
        let watched: Source<MeterFrame> | undefined;
        let stop = () => {};
        const paint = () => {
          const { config, orientation, source } = part.store.get();
          if (!source) {
            return;
          }
          const frame = source.getSnapshot();
          if (frame.levels.length !== part.store.get().channelCount) {
            part.store.set({ channelCount: frame.levels.length });
          }
          for (const [index, registered] of part.api.channels) {
            if (index < frame.levels.length) {
              const nodes = resolve(registered);
              const view = channelView(frame, index, config);
              paintChannel(
                { ...nodes, value: undefined },
                view,
                index,
                orientation
              );
              if (nodes.value) {
                writeText(nodes.value, view.text);
              }
            }
          }
        };
        const watch = () => {
          const { source } = part.store.get();
          if (source !== watched) {
            stop();
            watched = source;
            stop = source ? source.subscribe(paint) : () => {};
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
            setPresence(node as HTMLElement, "data-clipped", false);
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
      attrs: (_state: MeterState) => ({ "aria-hidden": "true" }),
      props: { index: { from: "channel", kind: "number", required: true } },
      state: (state: MeterState, { props }) =>
        channelState(state, Number(props.index ?? 0)),
    }),
  }),
  state: stateOf,
  // What the options give, not what the parts registered: the labels stay.
  sync: (options: MeterPrimitiveOptions) => {
    const { labelled: _labelled, ...held } = stateOf(options);
    return held;
  },
});
