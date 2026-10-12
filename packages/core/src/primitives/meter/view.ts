import { type LevelScale, levelPosition } from "./scale";

export type MeterOrientation = "horizontal" | "vertical";

/** Levels read to one decimal: finer than a meter can be read, and a plain number rather than a share of the range. */
export const DEFAULT_METER_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 1,
};

/** One reading of the meter: a level per channel, and optionally a peak-hold level per channel. */
export interface MeterFrame {
  levels: readonly number[];
  peaks?: readonly number[] | undefined;
}

/** What one channel shows for a level: everything both the React render and the per-frame DOM writes derive from. */
export interface MeterChannelView {
  clipping: boolean;
  /** Peak mark position, 0…1; undefined when there is no peak for the channel. */
  peakPercent: number | undefined;
  /** Indicator length, 0…1. */
  percent: number;
  text: string;
  valueNow: number;
  /** At or above the warning level, and not yet clipping. */
  warning: boolean;
}

export interface MeterConfig {
  clipThreshold: number;
  format: Intl.NumberFormatOptions;
  formatter: Intl.NumberFormat;
  locale: Intl.LocalesArgument | undefined;
  max: number;
  min: number;
  /** A level's position along the length, 0…1. */
  position: (level: number) => number;
  warnThreshold: number;
}

/** Builds the config a meter reads its levels with: the position along its length, and how levels are written. */
export function createMeterConfig(options: {
  clipThreshold?: number;
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  max?: number;
  min?: number;
  scale?: LevelScale;
  warnThreshold?: number;
}): MeterConfig {
  const {
    clipThreshold = 0,
    format = DEFAULT_METER_FORMAT,
    locale,
    max = 6,
    min = -60,
    scale = "linear",
    warnThreshold = Number.POSITIVE_INFINITY,
  } = options;
  return {
    clipThreshold,
    format,
    formatter: new Intl.NumberFormat(locale, format),
    locale,
    max,
    min,
    position: levelPosition(scale, min, max),
    warnThreshold,
  };
}

export function channelView(
  frame: MeterFrame,
  index: number,
  config: MeterConfig
): MeterChannelView {
  const { clipThreshold, formatter, min, position, warnThreshold } = config;
  const level = frame.levels[index] ?? min;
  const peak = frame.peaks?.[index];
  const toPercent = position;
  // One decimal keeps a live signal from rewriting the attribute every frame.
  const valueNow = Math.round(level * 10) / 10;
  return {
    clipping: level >= clipThreshold,
    peakPercent: peak === undefined ? undefined : toPercent(peak),
    percent: toPercent(level),
    text: formatter.format(valueNow),
    valueNow,
    warning: level >= warnThreshold && level < clipThreshold,
  };
}

export type MeterChannelPart = "channel" | "indicator" | "peak" | "value";

/** The DOM nodes of one channel that a live source writes to. */
export interface MeterChannelNodes {
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

export function setPresence(
  node: HTMLElement,
  attribute: string,
  present: boolean
) {
  if (present) {
    node.setAttribute(attribute, "");
  } else {
    node.removeAttribute(attribute);
  }
}

/** Write one channel's view straight to its nodes, touching only what changed. */
export function paintChannel(
  nodes: MeterChannelNodes,
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
  // Update React's own text node in place rather than replacing it.
  const text = value?.firstChild;
  if (text?.nodeType === Node.TEXT_NODE && text.nodeValue !== view.text) {
    text.nodeValue = view.text;
  }
}
