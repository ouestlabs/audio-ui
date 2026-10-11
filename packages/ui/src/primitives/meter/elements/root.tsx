import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useLocale } from "../../internal/use-locale";
import { MeterContext, type MeterContextValue } from "../context";
import { type LevelScale, levelPosition } from "../internal/scale";
import {
  type ChannelNodes,
  type ChannelPart,
  channelView,
  DEFAULT_FORMAT,
  type MeterConfig,
  type Orientation,
  paintChannel,
} from "../internal/shared";
import type { Channel } from "./channel";

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
    scale = "linear",
    source,
    style,
    value,
    warnThreshold = Number.POSITIVE_INFINITY,
    ...elementProps
  } = componentProps;

  const resolvedLocale = useLocale(locale);
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(resolvedLocale, format),
    [format, resolvedLocale]
  );
  const position = React.useMemo(
    () => levelPosition(scale, min, max),
    [max, min, scale]
  );
  const config = React.useMemo<MeterConfig>(
    () => ({
      clipThreshold,
      format,
      formatter,
      locale,
      max,
      min,
      position,
      warnThreshold,
    }),
    [
      clipThreshold,
      format,
      formatter,
      locale,
      max,
      min,
      position,
      warnThreshold,
    ]
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

  // A click anywhere on the meter clears what the live source latched, as in a DAW.
  const clearClipped = (event: React.MouseEvent<HTMLElement>) => {
    for (const node of event.currentTarget.querySelectorAll("[data-clipped]")) {
      node.removeAttribute("data-clipped");
    }
  };

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { onClick: clearClipped, role: "group" },
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
    /** How levels are spread along the length: evenly (`"linear"`), as digital peak meters do with more room at the top (`"iec"`), or by your own increasing curve. @default "linear" */
    scale?: LevelScale;
    /** A live signal painted outside React; takes precedence over `value` and `peak`. */
    source?: Source;
    /** Level per channel; the array length is the channel count. */
    value?: readonly number[];
    /** Level at or above which a channel is in its warning zone, below the clip threshold: `data-warning`. Unset, there is no warning zone. */
    warnThreshold?: number;
  }
}
