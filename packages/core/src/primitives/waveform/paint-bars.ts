import { createFrameTask } from "../../dom/frame.ts";
import { observeVisibility } from "../../dom/visibility.ts";
import type { Source } from "../../value/source.ts";
import { createLevelsEngine, type WaveformIdle } from "./levels-engine.ts";
import {
  peakCount,
  peakMagnitudes,
  rangeShares,
  type WaveformPeaks,
} from "./peaks.ts";

const LEVEL_PROPERTY = "--waveform-level";
/** A level has to move this much before its bar is written to again. */
const PAINT_EPSILON = 0.002;
/** With reduced motion, the bars repaint this often at most. */
const REDUCED_MOTION_INTERVAL_MS = 250;

/** The played share of the audio, 0…1, as it changes. */
export interface WaveformPlayed {
  get: () => number;
  subscribe: (listener: () => void) => () => void;
}

export interface WaveformBarsOptions {
  /** How many bars there are. */
  count: number;
  /** Length of the audio, in the unit `range` is in. */
  duration: number;
  /** Visual gain applied to the levels before they are drawn. @default 1 */
  gain?: number;
  /** What the bars do while there is no signal. @default "none" */
  idle?: WaveformIdle;
  /** A live signal, 0…1 per level, followed instead of `peaks`. */
  levels?: Source<ArrayLike<number>>;
  /** Whether the audio is still on its way: the bars sweep. */
  loading?: boolean;
  /** Resting level, 0…1. @default 0.08 */
  minLevel?: number;
  /** Mirrors the levels around the middle bar, the first one in the center. */
  mirrored?: boolean;
  /** The audio's shape, when it is known upfront. */
  peaks?: WaveformPeaks;
  /** The played share, which marks the bars it has passed `data-played`. */
  played: WaveformPlayed;
  /** The stretch of the audio shown, `[start, end]` in `duration` units. */
  range: readonly [number, number];
  /** Whether motion is reduced: the bars repaint four times a second at most. */
  reducedMotion?: boolean;
}

/**
 * Draws a waveform as `count` elements, `bar(index)` each: writes each
 * one's level, 0…1, to its `--waveform-level` CSS variable, rising at once
 * and falling smoothly, and nothing while they rest or `root` is off screen.
 * Bars the played share has passed get `data-played`. Returns what stops it.
 */
export function attachWaveformBars(
  root: Element,
  bar: (index: number) => HTMLElement | null | undefined,
  options: WaveformBarsOptions
): () => void {
  const { count, duration, levels: live, peaks, played, range } = options;
  const reducedMotion = options.reducedMotion ?? false;
  const engine = createLevelsEngine({
    count,
    gain: options.gain ?? 1,
    idle: options.idle ?? "none",
    loading: options.loading ?? false,
    minLevel: options.minLevel ?? 0.08,
    mirrored: options.mirrored ?? false,
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
        bar(index)?.style.setProperty(LEVEL_PROPERTY, level.toFixed(4));
      }
    }
    return !engine.settled;
  });
  const markPlayed = () => {
    const share = played.get();
    for (let index = 0; index < count; index += 1) {
      bar(index)?.toggleAttribute(
        "data-played",
        (index + 0.5) / count <= share
      );
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
  const unsubscribePlayed = played.subscribe(markPlayed);
  const unsubscribeLevels = live?.subscribe(() => {
    input = live.getSnapshot();
    task.wake();
  });
  return () => {
    task.stop();
    stopObservingVisibility();
    unsubscribePlayed();
    unsubscribeLevels?.();
  };
}
