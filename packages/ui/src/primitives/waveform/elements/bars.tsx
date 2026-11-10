import { attachWaveformBars, type WaveformIdle } from "@audio-ui/core/waveform";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useReducedMotion } from "../../internal/use-reduced-motion.ts";
import { useWaveformContext, type WaveformState } from "../context.ts";

const LEVEL_PROPERTY = "--waveform-level";

const BAR_STATE_ATTRIBUTES_MAPPING = {
  index: (index: number) => ({ "data-index": String(index) }),
};

interface BarsContextValue {
  minLevel: number;
  register: (index: number, node: HTMLElement | null) => void;
}

const BarsContext = React.createContext<BarsContextValue | null>(null);

const renderBar = (index: number) => <Bar index={index} key={index} />;

/**
 * Draws the waveform as a fixed number of elements, one `Waveform.Bar` each,
 * for a visualizer styled in plain CSS. Each bar's level, 0…1, is written to
 * its `--waveform-level` CSS variable outside React: levels rise at once and
 * fall smoothly, and nothing is written while they rest or sit off screen.
 * Bars the playback position has passed carry `data-played`.
 *
 * Its children are a function called once per bar; left out, plain bars are
 * rendered. Renders a `<div>` element.
 */
export function Bars(componentProps: Bars.Props) {
  const {
    children = renderBar,
    className,
    count = 24,
    gain = 1,
    idle = "none",
    minLevel = 0.08,
    mirrored = false,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = useWaveformContext("Bars");
  const { duration, levels: live, peaks, position, range } = meta;
  const { loading } = state;
  const reducedMotion = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const nodesRef = React.useRef<(HTMLElement | null)[]>([]);

  const register = React.useCallback(
    (index: number, node: HTMLElement | null) => {
      nodesRef.current[index] = node;
    },
    []
  );

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    return attachWaveformBars(root, (index) => nodesRef.current[index], {
      count,
      duration,
      gain,
      idle,
      levels: live,
      loading,
      minLevel,
      mirrored,
      peaks,
      played: position,
      range,
      reducedMotion,
    });
  }, [
    count,
    duration,
    gain,
    idle,
    live,
    loading,
    minLevel,
    mirrored,
    peaks,
    position,
    range,
    reducedMotion,
  ]);

  const context = React.useMemo<BarsContextValue>(
    () => ({ minLevel, register }),
    [minLevel, register]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: Array.from({ length: count }, (_, index) =>
          children(index, count)
        ),
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, rootRef] : rootRef,
    render,
    state,
  });

  return <BarsContext value={context}>{element}</BarsContext>;
}

export namespace Bars {
  export type State = WaveformState;
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    /** Called once per bar; returns its `Waveform.Bar`. */
    children?: (index: number, count: number) => React.ReactNode;
    /** How many bars to draw. The levels are fitted to them. @default 24 */
    count?: number;
    /** Visual gain applied to the levels before they are drawn. @default 1 */
    gain?: number;
    /** What the bars do while there is no signal. @default "none" */
    idle?: WaveformIdle;
    /** Resting level, 0…1: silent bars keep this much of their size. @default 0.08 */
    minLevel?: number;
    /** Mirrors the levels around the middle bar, the first one in the center. @default false */
    mirrored?: boolean;
  }
}

/**
 * One bar of `Waveform.Bars`. Its level, 0…1, is its `--waveform-level` CSS
 * variable: size it with `height: calc(var(--waveform-level) * 100%)`, or the
 * width for a vertical layout. Renders a `<span>` element.
 */
export function Bar(componentProps: Bar.Props) {
  const { className, index, ref, render, style, ...elementProps } =
    componentProps;
  const { state: rootState } = useWaveformContext("Bar");
  const bars = React.use(BarsContext);
  if (!bars) {
    throw new Error("Waveform.Bar must be used within Waveform.Bars");
  }
  const { minLevel, register } = bars;
  const registerRef = React.useCallback(
    (node: HTMLElement | null) => register(index, node),
    [index, register]
  );
  const state = React.useMemo<Bar.State>(
    () => ({ ...rootState, index }),
    [index, rootState]
  );
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { style: { [LEVEL_PROPERTY]: minLevel } as React.CSSProperties },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
    state,
    stateAttributesMapping: BAR_STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Bar {
  export type State = WaveformState & {
    /** The bar's place in the row, from 0. */
    index: number;
  };
  export interface Props extends PartProps<"span", State> {
    /** The bar's place in the row, from 0. */
    index: number;
  }
}
