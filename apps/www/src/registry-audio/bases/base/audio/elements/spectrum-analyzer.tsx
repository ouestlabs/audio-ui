"use client";

import type { Plot as PlotPrimitive, Source } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCursor,
  PlotGraph,
  PlotGrid,
  PlotTrace,
  PlotTraceArea,
} from "@/registry-audio/bases/base/audio/elements/plot";
import { useSpectrumPeaks } from "@/registry-audio/bases/base/hooks/use-spectrum";

const formatHz = (hz: number) =>
  hz >= 1000 ? `${Number((hz / 1000).toFixed(1))} kHz` : `${Math.round(hz)} Hz`;
/** Every 20 dB strictly inside the scale, so no label sits on an edge. */
const dbTicks = (min: number, max: number) => {
  const ticks: number[] = [];
  for (let db = Math.floor(min / 20) * 20 + 20; db < max; db += 20) {
    if (db > min) {
      ticks.push(db);
    }
  }
  return ticks;
};
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${Math.round(point.y)} dB`;

type SpectrumAnalyzerProps = Omit<
  PlotPrimitive.Root.Props,
  "children" | "maxX" | "maxY" | "minX" | "minY" | "scaleX" | "scaleY"
> & {
  /** The loudest level drawn, in dB. @default -10 */
  maxDb?: number;
  /** Highest frequency on the axis: the same as the spectrum's. @default 20000 */
  maxHz?: number;
  /** The quietest level drawn, in dB. @default -100 */
  minDb?: number;
  /** Lowest frequency on the axis: the same as the spectrum's. @default 20 */
  minHz?: number;
  /** Draws each point's recent peak over the spectrum, held a moment and then falling. @default true */
  peakHold?: boolean;
  /** The live spectrum, dB per point along a log frequency axis, such as `useSpectrum` returns. */
  source: Source<Float32Array>;
};

/**
 * A spectrum analyzer: the level of the sound across frequencies, on a log
 * axis in hertz and a scale in dB, with the recent peaks held over it. It
 * follows a live `source` frame by frame without re-rendering React. Point at
 * it to read the frequency and level under the pointer.
 */
function SpectrumAnalyzer({
  className,
  maxDb = -10,
  maxHz = 20_000,
  minDb = -100,
  minHz = 20,
  peakHold = true,
  source,
  ...props
}: SpectrumAnalyzerProps) {
  const peaks = useSpectrumPeaks(source);
  return (
    <Plot
      className={cn("h-40", className)}
      maxX={maxHz}
      maxY={maxDb}
      minX={minHz}
      minY={minDb}
      scaleX="log"
      {...props}
    >
      <PlotGrid x={{ count: 6 }} y={{ ticks: dbTicks(minDb, maxDb) }} />
      <PlotGraph>
        <PlotTraceArea
          className="fill-primary/20"
          fillTo={minDb}
          source={source}
        />
        <PlotTrace className="stroke-primary/80" source={source} />
        {peakHold ? (
          <PlotTrace className="stroke-foreground/40" source={peaks} />
        ) : null}
      </PlotGraph>
      <PlotCursor format={describePointer} />
    </Plot>
  );
}

export { SpectrumAnalyzer };
