import type * as React from "react";
import { clampUnit } from "../../../utils";
import type { Channel } from "../elements/channel";
import type { Root } from "../elements/root";

export type Orientation = "horizontal" | "vertical";

/** Levels read to one decimal: finer than a meter can be read, and a plain number rather than a share of the range. */
export const DEFAULT_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 1,
};

/** What one channel shows for a level: everything both the React render and the per-frame DOM writes derive from. */
export interface ChannelView {
  clipping: boolean;
  /** Peak mark position, 0…1; undefined when there is no peak for the channel. */
  peakPercent: number | undefined;
  /** Indicator length, 0…1. */
  percent: number;
  text: string;
  valueNow: number;
}

export interface MeterConfig {
  clipThreshold: number;
  format: Intl.NumberFormatOptions;
  formatter: Intl.NumberFormat;
  locale: Intl.LocalesArgument | undefined;
  max: number;
  min: number;
}

export function channelView(
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

export function indicatorStyle(
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

export type ChannelPart = "channel" | "indicator" | "peak" | "value";

/** The DOM nodes of one channel that a live source writes to. */
export interface ChannelNodes {
  channel?: HTMLElement;
  getAriaValueText?: Channel.Props["getAriaValueText"];
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
