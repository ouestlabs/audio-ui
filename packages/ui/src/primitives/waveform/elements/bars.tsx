import { createFrameTask, observeVisibility } from "@audio-ui/core";
import {
  createLevelsEngine,
  peakCount,
  peakMagnitudes,
  rangeShares,
  type WaveformIdle,
} from "@audio-ui/core/waveform";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useReducedMotion } from "../../internal/use-reduced-motion.ts";
import { useWaveformContext, type WaveformState } from "../context.ts";

const LEVEL_PROPERTY = "--waveform-level";
/** A level has to move this much before its bar is written to again. */
const PAINT_EPSILON = 0.002;
/** With reduced motion, the bars repaint this often at most. */
const REDUCED_MOTION_INTERVAL_MS = 250;

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
    const engine = createLevelsEngine({
      count,
      gain,
      idle,
      loading,
      minLevel,
      mirrored,
      reducedMotion,
    });
    const shown = new Float32Array(engine.levels.length).fill(-1);
    let input: ArrayLike<number> | undefined;
    if (live) {
      input = live.getSnapshot();
    } else if (peaks) {
      // The shown stretch at the data's own resolution: the engine fits it to the bars.
      const [from, to] = rangeShares(range, duration);
      const entries = Math.max(1, Math.round((to - from) * peakCount(peaks)));
      input = peakMagnitudes(peaks, from, to, entries);
    }
    let visible = true;
    let clock = 0;
    let unpaintedMs = 0;
    let sincePaintMs = Number.POSITIVE_INFINITY;

    const task = createFrameTask((elapsedMs) => {
      if (!visible) {
        return false;
      }
      unpaintedMs += elapsedMs;
      sincePaintMs += elapsedMs;
      if (reducedMotion && sincePaintMs < REDUCED_MOTION_INTERVAL_MS) {
        return true;
      }
      clock += unpaintedMs;
      unpaintedMs = 0;
      sincePaintMs = 0;
      engine.step(clock, input);
      for (const [index, level] of engine.levels.entries()) {
        if (Math.abs(level - (shown[index] ?? -1)) > PAINT_EPSILON) {
          shown[index] = level;
          nodesRef.current[index]?.style.setProperty(
            LEVEL_PROPERTY,
            level.toFixed(4)
          );
        }
      }
      return !engine.settled;
    });

    const markPlayed = () => {
      const played = position.get();
      for (const [index, node] of nodesRef.current.entries()) {
        node?.toggleAttribute("data-played", (index + 0.5) / count <= played);
      }
    };

    task.flush();
    markPlayed();
    const stopObservingVisibility = observeVisibility(root, (next) => {
      visible = next;
      if (next) {
        task.wake();
      }
    });
    const unsubscribePosition = position.subscribe(markPlayed);
    const unsubscribeLevels = live?.subscribe(() => {
      input = live.getSnapshot();
      task.wake();
    });

    return () => {
      task.stop();
      stopObservingVisibility();
      unsubscribePosition();
      unsubscribeLevels?.();
    };
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
