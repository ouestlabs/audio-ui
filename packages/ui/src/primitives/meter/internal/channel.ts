import * as React from "react";
import { ChannelIndexContext, useMeterContext } from "../context";
import type { Channel } from "../elements/channel";
import { type ChannelPart, channelView } from "./shared";

/** Shared by a channel and the parts inside it: the channel's view, state, and a ref that registers the node for live painting. */
export function useChannelPart(
  part: string,
  index: number,
  nodeKey: ChannelPart
) {
  const { actions, meta, state } = useMeterContext(part);
  const view = channelView(meta.frame, index, meta.config);
  const partState = React.useMemo<Channel.State>(
    () => ({
      clipping: view.clipping,
      index,
      orientation: state.orientation,
      warning: view.warning,
    }),
    [index, state.orientation, view.clipping, view.warning]
  );
  const { registerNode } = actions;
  const registerRef = React.useCallback(
    (node: HTMLElement | null) => registerNode(index, nodeKey, node),
    [index, nodeKey, registerNode]
  );
  return { actions, config: meta.config, partState, registerRef, view };
}

export function useChannelIndex(part: string): number {
  const index = React.use(ChannelIndexContext);
  if (index === null) {
    throw new Error(`Meter.${part} must be used within Meter.Channel`);
  }
  return index;
}

export function useMergedRef<T>(
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
export function channelDataAttributes(state: Channel.State) {
  return {
    "data-clipping": state.clipping ? "" : undefined,
    "data-orientation": state.orientation,
    "data-warning": state.warning ? "" : undefined,
  };
}
