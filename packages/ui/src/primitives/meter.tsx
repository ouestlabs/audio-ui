import { mergeProps } from "@base-ui/react/merge-props";
import { Meter as BaseMeter } from "@base-ui/react/meter";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clampUnit } from "../utils";
import { type PartProps, resolveStyling } from "./internal/part";

type Orientation = "horizontal" | "vertical";

/** Levels read to one decimal: finer than a meter can be read, and a plain number rather than a share of the range. */
const DEFAULT_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

/** What one channel shows for a level: everything both the React render and the per-frame DOM writes derive from. */
interface ChannelView {
  clipping: boolean;
  /** Peak mark position, 0…1; undefined when there is no peak for the channel. */
  peakPercent: number | undefined;
  /** Indicator length, 0…1. */
  percent: number;
  text: string;
  valueNow: number;
}

interface MeterConfig {
  clipThreshold: number;
  format: Intl.NumberFormatOptions;
  formatter: Intl.NumberFormat;
  locale: Intl.LocalesArgument | undefined;
  max: number;
  min: number;
}

function channelView(
  frame: Root.Frame,
  index: number,
  config: MeterConfig
): ChannelView {
  const { clipThreshold, formatter, max, min } = config;
  const level = frame.levels[index] ?? min;
  const peak = frame.peaks?.[index];
  const toPercent = (db: number) => clampUnit((db - min) / (max - min || 1));
  // One decimal keeps a live signal from rewriting the attribute every frame.
  const valueNow = Math.round(level * 10) / 10;
  return {
    clipping: level >= clipThreshold,
    peakPercent: peak === undefined ? undefined : toPercent(peak),
    percent: toPercent(level),
    text: formatter.format(valueNow),
    valueNow,
  };
}

function indicatorStyle(
  orientation: Orientation,
  percent: number
): React.CSSProperties {
  return orientation === "horizontal"
    ? {
        height: "100%",
        transform: `scaleX(${percent})`,
        transformOrigin: "left center",
        width: "100%",
        willChange: "transform",
      }
    : {
        height: "100%",
        transform: `scaleY(${percent})`,
        transformOrigin: "center bottom",
        width: "100%",
        willChange: "transform",
      };
}

type ChannelPart = "channel" | "indicator" | "peak" | "value";

/** The DOM nodes of one channel that a live source writes to. */
interface ChannelNodes {
  channel?: HTMLElement;
  getAriaValueText?: Channel.Props["getAriaValueText"];
  indicator?: HTMLElement;
  peak?: HTMLElement;
  value?: HTMLElement;
}

interface MeterContextValue {
  actions: {
    registerNode: (
      index: number,
      part: ChannelPart,
      node: HTMLElement | null
    ) => void;
    setAriaValueTextGetter: (
      index: number,
      getter: Channel.Props["getAriaValueText"]
    ) => void;
  };
  meta: {
    channelCount: number;
    config: MeterConfig;
    /** The frame parts render from: `value`/`peak`, or the source's snapshot at render time. */
    frame: Root.Frame;
  };
  state: Root.State;
}

const MeterContext = React.createContext<MeterContextValue | null>(null);
const ChannelIndexContext = React.createContext<number | null>(null);

function useMeterContext(part: string): MeterContextValue {
  const context = React.use(MeterContext);
  if (!context) {
    throw new Error(`Meter.${part} must be used within Meter.Root`);
  }
  return context;
}

function setPresence(node: HTMLElement, attribute: string, present: boolean) {
  if (present) {
    node.setAttribute(attribute, "");
  } else {
    node.removeAttribute(attribute);
  }
}

/** Write one channel's view straight to its nodes, touching only what changed. */
function paintChannel(
  nodes: ChannelNodes,
  view: ChannelView,
  index: number,
  orientation: Orientation
) {
  const { channel, indicator, peak, value } = nodes;
  if (indicator) {
    indicator.style.transform =
      orientation === "horizontal"
        ? `scaleX(${view.percent})`
        : `scaleY(${view.percent})`;
    setPresence(indicator, "data-clipping", view.clipping);
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
  }
  // Update React's own text node in place rather than replacing it.
  const text = value?.firstChild;
  if (text?.nodeType === Node.TEXT_NODE && text.nodeValue !== view.text) {
    text.nodeValue = view.text;
  }
}

/**
 * Groups the channels of a level meter. Levels come either from `value` (and
 * `peak`) as React props, or from a live `source`: with a source the meter
 * writes each frame straight to the DOM, so a signal updating 60 times a
 * second never re-renders React. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    clipThreshold = 0,
    format = DEFAULT_FORMAT,
    locale,
    max = 6,
    min = -60,
    orientation = "vertical",
    peak,
    ref,
    render,
    source,
    style,
    value,
    ...elementProps
  } = componentProps;

  const formatter = React.useMemo(
    () => new Intl.NumberFormat(locale, format),
    [format, locale]
  );
  const config = React.useMemo<MeterConfig>(
    () => ({ clipThreshold, format, formatter, locale, max, min }),
    [clipThreshold, format, formatter, locale, max, min]
  );

  const frame = React.useMemo<Root.Frame>(
    () =>
      source ? source.getSnapshot() : { levels: value ?? [], peaks: peak },
    [peak, source, value]
  );
  // A live source can change its channel count between frames; only that re-renders.
  const [sourceChannelCount, setSourceChannelCount] = React.useState(
    frame.levels.length
  );
  const channelCount = source ? sourceChannelCount : frame.levels.length;

  const nodesRef = React.useRef(new Map<number, ChannelNodes>());
  const channelNodes = React.useCallback((index: number) => {
    let nodes = nodesRef.current.get(index);
    if (!nodes) {
      nodes = {};
      nodesRef.current.set(index, nodes);
    }
    return nodes;
  }, []);
  const registerNode = React.useCallback(
    (index: number, part: ChannelPart, node: HTMLElement | null) => {
      channelNodes(index)[part] = node ?? undefined;
    },
    [channelNodes]
  );
  const setAriaValueTextGetter = React.useCallback(
    (index: number, getter: Channel.Props["getAriaValueText"]) => {
      channelNodes(index).getAriaValueText = getter;
    },
    [channelNodes]
  );

  React.useEffect(() => {
    if (!source) {
      return;
    }
    const paint = () => {
      const next = source.getSnapshot();
      setSourceChannelCount(next.levels.length);
      for (const [index, nodes] of nodesRef.current) {
        if (index < next.levels.length) {
          paintChannel(
            nodes,
            channelView(next, index, config),
            index,
            orientation
          );
        }
      }
    };
    paint();
    return source.subscribe(paint);
  }, [config, orientation, source]);

  const state = React.useMemo<Root.State>(
    () => ({ orientation }),
    [orientation]
  );

  const context = React.useMemo<MeterContextValue>(
    () => ({
      actions: { registerNode, setAriaValueTextGetter },
      meta: { channelCount, config, frame },
      state,
    }),
    [channelCount, config, frame, registerNode, setAriaValueTextGetter, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { role: "group" },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });

  return <MeterContext value={context}>{element}</MeterContext>;
}

export namespace Root {
  export type State = {
    orientation: Orientation;
  };

  /** One reading of the meter: a level per channel, and optionally a peak-hold level per channel. */
  export interface Frame {
    levels: readonly number[];
    peaks?: readonly number[] | undefined;
  }

  /**
   * A live signal, in the shape of an external store: `subscribe` registers a
   * listener called on each new frame, `getSnapshot` returns the latest one.
   */
  export interface Source {
    getSnapshot: () => Frame;
    subscribe: (listener: () => void) => () => void;
  }

  export interface Props extends PartProps<"div", State> {
    /** Level at or above which a channel is clipping. @default 0 */
    clipThreshold?: number;
    /** Formats each level for `Meter.Value` and the channels' `aria-valuetext`. Defaults to one decimal. */
    format?: Intl.NumberFormatOptions;
    locale?: Intl.LocalesArgument;
    /** @default 6 */
    max?: number;
    /** @default -60 */
    min?: number;
    /** @default "vertical" */
    orientation?: Orientation;
    /** Peak-hold level per channel. Timing and decay live outside the primitive. */
    peak?: readonly number[];
    /** A live signal painted outside React; takes precedence over `value` and `peak`. */
    source?: Source;
    /** Level per channel; the array length is the channel count. */
    value?: readonly number[];
  }
}

/** Renders one child per channel. */
export function Channels({ children }: Channels.Props) {
  const { meta } = useMeterContext("Channels");
  return (
    <>
      {Array.from({ length: meta.channelCount }, (_, index) =>
        children(index, meta.channelCount)
      )}
    </>
  );
}

export namespace Channels {
  export interface Props {
    children: (index: number, channelCount: number) => React.ReactNode;
  }
}

/** Shared by a channel and the parts inside it: the channel's view, state, and a ref that registers the node for live painting. */
function useChannelPart(part: string, index: number, nodeKey: ChannelPart) {
  const { actions, meta, state } = useMeterContext(part);
  const view = channelView(meta.frame, index, meta.config);
  const partState = React.useMemo<Channel.State>(
    () => ({ clipping: view.clipping, index, orientation: state.orientation }),
    [index, state.orientation, view.clipping]
  );
  const { registerNode } = actions;
  const registerRef = React.useCallback(
    (node: HTMLElement | null) => registerNode(index, nodeKey, node),
    [index, nodeKey, registerNode]
  );
  return { actions, config: meta.config, partState, registerRef, view };
}

function useChannelIndex(part: string): number {
  const index = React.use(ChannelIndexContext);
  if (index === null) {
    throw new Error(`Meter.${part} must be used within Meter.Channel`);
  }
  return index;
}

function useMergedRef<T>(
  a: React.Ref<T> | undefined,
  b: (node: T | null) => void
): (node: T | null) => void {
  return React.useCallback(
    (node: T | null) => {
      b(node);
      if (typeof a === "function") {
        a(node);
      } else if (a) {
        a.current = node;
      }
    },
    [a, b]
  );
}

/** The presence attributes every channel part carries. */
function channelDataAttributes(state: Channel.State) {
  return {
    "data-clipping": state.clipping ? "" : undefined,
    "data-orientation": state.orientation,
  };
}

/**
 * One channel of the meter, a `role="meter"`: name it with `aria-label` or a
 * `Meter.Label`. Carries `data-clipping` at or above the clip threshold.
 * Renders a `<div>` element.
 */
export function Channel(componentProps: Channel.Props) {
  const { className, getAriaValueText, index, ref, style, ...props } =
    componentProps;
  const { actions, config, partState, registerRef, view } = useChannelPart(
    "Channel",
    index,
    "channel"
  );
  // Kept current for the live source, which builds the value text outside React.
  actions.setAriaValueTextGetter(index, getAriaValueText);
  const mergedRef = useMergedRef(ref, registerRef);
  const baseGetAriaValueText = React.useCallback(
    (formattedValue: string, value: number) =>
      getAriaValueText?.(formattedValue, value, index) ?? formattedValue,
    [getAriaValueText, index]
  );

  return (
    <ChannelIndexContext value={index}>
      <BaseMeter.Root
        {...channelDataAttributes(partState)}
        format={config.format}
        getAriaValueText={baseGetAriaValueText}
        locale={config.locale}
        max={config.max}
        min={config.min}
        value={view.valueNow}
        {...props}
        {...resolveStyling(className, style, partState)}
        ref={mergedRef}
      />
    </ChannelIndexContext>
  );
}

export namespace Channel {
  export type State = Root.State & {
    /** Whether the level is at or above the clip threshold. */
    clipping: boolean;
    index: number;
  };
  export interface Props
    extends Omit<
      BaseMeter.Root.Props,
      | "className"
      | "format"
      | "getAriaValueText"
      | "locale"
      | "max"
      | "min"
      | "style"
      | "value"
    > {
    className?: string | ((state: State) => string | undefined);
    /** Returns the channel's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted level. */
    getAriaValueText?: (
      formattedValue: string,
      value: number,
      index: number
    ) => string;
    /** Index of the channel in the levels. */
    index: number;
    ref?: React.Ref<HTMLDivElement>;
    style?:
      | React.CSSProperties
      | ((state: State) => React.CSSProperties | undefined);
  }
}

/** Accessible label of the channel it is in. Renders a `<span>` element. */
export const { Label } = BaseMeter;
export namespace Label {
  export type Props = BaseMeter.Label.Props;
  export type State = BaseMeter.Label.State;
}

/** The full range of a channel, behind the indicator. Renders a `<div>` element. */
export const { Track } = BaseMeter;
export namespace Track {
  export type Props = BaseMeter.Track.Props;
  export type State = BaseMeter.Track.State;
}

/** The lit part of the channel, scaled to the level. Renders a `<div>` element. */
export function Indicator(componentProps: Indicator.Props) {
  const { className, ref, style, ...props } = componentProps;
  const index = useChannelIndex("Indicator");
  const { partState, registerRef, view } = useChannelPart(
    "Indicator",
    index,
    "indicator"
  );
  const mergedRef = useMergedRef(ref, registerRef);
  const resolved = resolveStyling(className, style, partState);
  return (
    <BaseMeter.Indicator
      aria-hidden="true"
      {...channelDataAttributes(partState)}
      {...props}
      className={resolved.className}
      ref={mergedRef}
      style={{
        ...indicatorStyle(partState.orientation, view.percent),
        ...resolved.style,
      }}
    />
  );
}

export namespace Indicator {
  export type State = Channel.State;
  export interface Props
    extends Omit<BaseMeter.Indicator.Props, "className" | "style"> {
    className?: string | ((state: State) => string | undefined);
    ref?: React.Ref<HTMLDivElement>;
    style?:
      | React.CSSProperties
      | ((state: State) => React.CSSProperties | undefined);
  }
}

/**
 * The peak-hold mark, positioned at the channel's peak level; hidden while
 * the channel has none. Renders a `<div>` element.
 */
export function Peak(componentProps: Peak.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const index = useChannelIndex("Peak");
  const { partState, registerRef, view } = useChannelPart(
    "Peak",
    index,
    "peak"
  );
  const position = `${(view.peakPercent ?? 0) * 100}%`;
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        hidden: view.peakPercent === undefined,
        style:
          partState.orientation === "horizontal"
            ? { left: position }
            : { bottom: position },
        ...channelDataAttributes(partState),
      },
      { ...elementProps, ...resolveStyling(className, style, partState) }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
  });
}

export namespace Peak {
  export type State = Channel.State;
  export type Props = PartProps<"div", State>;
}

/**
 * The channel's formatted level (`format`/`locale` on Root). With a live
 * `source` only the default text is kept current, not a `children` function.
 * Renders a `<span>` element.
 */
export function Value({ ref, ...props }: Value.Props) {
  const index = useChannelIndex("Value");
  const { registerRef } = useChannelPart("Value", index, "value");
  const mergedRef = useMergedRef(ref, registerRef);
  return <BaseMeter.Value {...props} ref={mergedRef} />;
}

export namespace Value {
  export type State = BaseMeter.Value.State;
  export type Props = BaseMeter.Value.Props & {
    ref?: React.Ref<HTMLSpanElement>;
  };
}
