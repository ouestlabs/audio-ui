import * as React from "react";
import type { Channel } from "./elements/channel";
import type { Root } from "./elements/root";
import type { ChannelPart, MeterConfig } from "./internal/shared";

export interface MeterContextValue {
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

export const MeterContext = React.createContext<MeterContextValue | null>(null);

export const ChannelIndexContext = React.createContext<number | null>(null);

export function useMeterContext(part: string): MeterContextValue {
  const context = React.use(MeterContext);
  if (!context) {
    throw new Error(`Meter.${part} must be used within Meter.Root`);
  }
  return context;
}
