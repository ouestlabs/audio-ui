"use client";

import { useCallback, useMemo, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Plot,
  PlotCursor,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import { usePulsesThroughCompressor } from "@/registry-audio/bases/base/hooks/use-pulses-through-compressor";
import { compressorOutput } from "@/registry-audio/bases/base/lib/filter-response";

const MIN_DB = -60;
const MAX_DB = 0;
/** Headroom past 0 dB, so the handle on the loudest level is not cut by the frame. */
const PLOT_MAX_DB = 6;
const MAX_RATIO = 20;
/** The least the loudest level can rise above the threshold, so the ratio stays finite. */
const MIN_RISE_DB = 0.5;
const DB_TICKS = [-48, -24, 0];
const describePointer = (point: { x: number; y: number }) =>
  `in ${point.x.toFixed(0)} dB`;
const UNITY = (inputDb: number) => inputDb;

/** A compressor's transfer curve: one handle sets the threshold, the other how hard the loudest level is held down (the ratio). */
export default function PlotCompressorDemo() {
  const [compressor, setCompressor] = useState({ ratio: 4, thresholdDb: -24 });
  const output = useMemo(() => compressorOutput(compressor), [compressor]);
  const loudest = output(MAX_DB);
  const { level, playing, toggle } = usePulsesThroughCompressor(compressor);
  // The input level, riding the curve: where the signal is right now.
  const dot = useMemo(
    () => ({
      getSnapshot: () => {
        const x = level.getSnapshot();
        return { x, y: output(x) };
      },
      subscribe: level.subscribe,
    }),
    [level, output]
  );
  const changeThreshold = useCallback(
    ({ x }: { x: number }) =>
      setCompressor((current) => ({ ...current, thresholdDb: x })),
    []
  );
  const changeRatio = useCallback(
    ({ y }: { y: number }) =>
      setCompressor((current) => ({
        ...current,
        ratio: Math.min(
          MAX_RATIO,
          Math.max(
            1,
            (MAX_DB - current.thresholdDb) /
              Math.max(y - current.thresholdDb, MIN_RISE_DB)
          )
        ),
      })),
    []
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <Plot
        className="h-40"
        maxX={PLOT_MAX_DB}
        maxY={PLOT_MAX_DB}
        minX={MIN_DB}
        minY={MIN_DB}
      >
        <PlotGraph>
          <PlotCurve
            className="stroke-border [stroke-dasharray:4_4]"
            fn={UNITY}
          />
          <PlotLine
            axis="x"
            className="stroke-foreground/40"
            value={compressor.thresholdDb}
          />
          <PlotCurve fn={output} />
        </PlotGraph>
        <PlotGrid x={{ ticks: DB_TICKS }} y={{ ticks: DB_TICKS.slice(0, 2) }} />
        <PlotCursor format={describePointer} />
        <PlotDot source={dot} />
        <PlotHandle
          aria-label="Threshold"
          axis="x"
          onValueChange={changeThreshold}
          value={{
            x: compressor.thresholdDb,
            y: output(compressor.thresholdDb),
          }}
        />
        <PlotHandle
          aria-label="Ratio"
          axis="y"
          onValueChange={changeRatio}
          value={{ x: MAX_DB, y: loudest }}
        />
      </Plot>
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label={
            playing
              ? "Stop the signal"
              : "Play a pulsing signal through the compressor"
          }
          onClick={toggle}
          size="icon-sm"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons={playing ? "PauseIcon" : "PlayIcon"}
            lucide={playing ? "PauseIcon" : "PlayIcon"}
            phosphor={playing ? "PauseIcon" : "PlayIcon"}
            remixicon={playing ? "RiPauseLine" : "RiPlayLine"}
            tabler={playing ? "IconPlayerPause" : "IconPlayerPlay"}
          />
        </Button>
        <output className="font-mono text-muted-foreground text-xs">
          Threshold {compressor.thresholdDb.toFixed(0)} dB,{" "}
          {compressor.ratio.toFixed(1)}:1
        </output>
      </div>
    </div>
  );
}
