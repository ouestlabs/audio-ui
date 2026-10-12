import type { MeterChannelPart, MeterConfig } from "@audio-ui/core/meter";
import * as React from "react";
import type { Channel } from "./elements/channel";
import type { Root } from "./elements/root";

export interface MeterContextValue {
  actions: {
    registerNode: (
      index: number,
      part: MeterChannelPart,
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

export const MeterContext = React.createContext<MeterContextValue | null>(null);

export const ChannelIndexContext = React.createContext<number | null>(null);

/** Lets a channel's `Label` name it: the label hands its id to `aria-labelledby`. */
export const ChannelLabelContext = React.createContext<
  ((id: string | undefined) => void) | null
>(null);

export function useMeterContext(part: string): MeterContextValue {
  const context = React.use(MeterContext);
  if (!context) {
    throw new Error(`Meter.${part} must be used within Meter.Root`);
  }
  return context;
}
