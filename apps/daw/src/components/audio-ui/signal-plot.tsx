import type { Source } from "@audio-ui/react";
import type { ComponentProps } from "react";
import {
  Plot,
  PlotGraph,
  PlotGrid,
  PlotTrace,
  PlotTraceArea,
} from "@/components/audio-ui/plot";
import { cn } from "@/lib/utils";

type PlotFrameProps = Omit<
  ComponentProps<typeof Plot>,
  "children" | "maxX" | "maxY" | "minX" | "minY" | "scaleX" | "scaleY"
>;

/** A live line drawn as a curve of the plot is: the same stroke, as it ran. */
const LIVE_LINE = "stroke-[1.5px] stroke-primary";
const noLabel = () => "";

interface ScopePlotProps extends PlotFrameProps {
  /** The samples, -1 to 1, such as a signal point's `scope({ fit: true })`. */
  source: Source<ArrayLike<number>>;
}

/**
 * A live wave, as a scope draws it: the samples of a source spread across,
 * -1 at the foot and 1 at the top, around a middle line. It follows the
 * source without a React render.
 */
function ScopePlot({
  "aria-label": label = "Wave",
  className,
  source,
  ...props
}: ScopePlotProps) {
  return (
    <Plot
      aria-label={label}
      className={cn("h-16 min-h-10", className)}
      data-slot="scope-plot"
      maxX={1}
      maxY={1}
      minX={0}
      minY={-1}
      {...props}
    >
      <PlotGrid y={{ format: noLabel, ticks: [0] }} />
      <PlotGraph>
        <PlotTrace className={LIVE_LINE} source={source} />
      </PlotGraph>
    </Plot>
  );
}

/** The spectrum's own scale, in dB of level. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const SPECTRUM_TICKS = [100, 1000, 10_000];
const formatHz = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);

interface SpectrumPlotProps extends PlotFrameProps {
  /** @default 20000 */
  maxHz?: number;
  /** @default 20 */
  minHz?: number;
  /** The spectrum in dB along a log frequency axis from `minHz` to `maxHz`, such as a signal point's `spectrum({ minHz, maxHz })`. */
  source: Source<ArrayLike<number>>;
}

/**
 * A live spectrum along a log frequency axis, filled, with a line on its
 * edge: where a sound has its energy, such as an organ's harmonics or the
 * sidebands of an FM voice. It follows the source without a React render.
 */
function SpectrumPlot({
  "aria-label": label = "Spectrum",
  className,
  maxHz = 20_000,
  minHz = 20,
  source,
  ...props
}: SpectrumPlotProps) {
  return (
    <Plot
      aria-label={label}
      className={cn("h-16 min-h-10", className)}
      data-slot="spectrum-plot"
      maxX={maxHz}
      maxY={SPECTRUM_MAX_DB}
      minX={minHz}
      minY={SPECTRUM_MIN_DB}
      scaleX="log"
      {...props}
    >
      <PlotGrid x={{ format: formatHz, ticks: SPECTRUM_TICKS }} />
      <PlotGraph>
        <PlotTraceArea fillTo={SPECTRUM_MIN_DB} source={source} />
        <PlotTrace className={LIVE_LINE} source={source} />
      </PlotGraph>
    </Plot>
  );
}

/** The level a level plot reaches down to, in dB. */
const LEVEL_FLOOR_DB = -60;

interface LevelPlotProps extends PlotFrameProps {
  /** The level in dB over time, the oldest first, such as a signal point's `history({ of: "level", seconds })`. */
  source: Source<ArrayLike<number>>;
  /** Another level over the same time, filled under the line of `source`: what went in, against what came out. Without it, `source` is filled. */
  under?: Source<ArrayLike<number>>;
}

/**
 * A live level over time, the newest at the end, from -60 dB at the foot to
 * full scale at the top: the shape of each hit, its attack and its decay, as
 * they scroll by. Given `under`, that level is filled and `source` is a line
 * over it, so a device's effect on the envelope shows as the gap between
 * them. It follows the sources without a React render.
 */
function LevelPlot({
  "aria-label": label = "Level over time",
  className,
  source,
  under,
  ...props
}: LevelPlotProps) {
  return (
    <Plot
      aria-label={label}
      className={cn("h-16 min-h-10", className)}
      data-slot="level-plot"
      maxX={1}
      maxY={0}
      minX={0}
      minY={LEVEL_FLOOR_DB}
      {...props}
    >
      <PlotGraph>
        <PlotTraceArea fillTo={LEVEL_FLOOR_DB} source={under ?? source} />
        <PlotTrace className={LIVE_LINE} source={source} />
      </PlotGraph>
    </Plot>
  );
}

export { LevelPlot, ScopePlot, SpectrumPlot };
