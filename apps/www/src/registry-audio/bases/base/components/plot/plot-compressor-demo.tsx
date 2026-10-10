"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotHandle,
  PlotLine,
  PlotMark,
} from "@/registry-audio/bases/base/audio/elements/plot";
import { compressorOutput } from "@/registry-audio/bases/base/lib/filter-response";

const MIN_DB = -60;
const MAX_DB = 0;
/** Headroom past 0 dB, so the handle on the loudest level is not cut by the frame. */
const PLOT_MAX_DB = 6;
const MAX_RATIO = 20;
/** The least the loudest level can rise above the threshold, so the ratio stays finite. */
const MIN_RISE_DB = 0.5;
const DB_LABELS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;

/** A compressor's transfer curve: one handle sets the threshold, the other how hard the loudest level is held down (the ratio). */
export default function PlotCompressorDemo() {
  const [compressor, setCompressor] = useState({ ratio: 4, thresholdDb: -24 });
  const output = useMemo(() => compressorOutput(compressor), [compressor]);
  const loudest = output(MAX_DB);
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
    <div className="flex w-full max-w-xl flex-col gap-2">
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
          {DB_LABELS.map((db) => (
            <PlotLine axis="x" key={`x${db}`} value={db} />
          ))}
          {DB_LABELS.map((db) => (
            <PlotLine axis="y" key={`y${db}`} value={db} />
          ))}
          <PlotLine
            axis="x"
            className="stroke-foreground/40"
            value={compressor.thresholdDb}
          />
          <PlotCurve fn={output} />
        </PlotGraph>
        {DB_LABELS.map((db) => (
          <PlotMark axis="x" key={`x${db}`} value={db}>
            {db}
          </PlotMark>
        ))}
        {DB_LABELS.slice(0, 2).map((db) => (
          <PlotMark axis="y" key={`y${db}`} value={db}>
            {db}
          </PlotMark>
        ))}
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
      <output className="text-center font-mono text-muted-foreground text-xs">
        Threshold {compressor.thresholdDb.toFixed(0)} dB,{" "}
        {compressor.ratio.toFixed(1)}:1
      </output>
    </div>
  );
}
