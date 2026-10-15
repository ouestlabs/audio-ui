"use client";

import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
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

const MIN_DB = -60;
const MAX_DB = 0;
/** Headroom past 0 dB, so the handle on the loudest level is not cut by the frame. */
const PLOT_MAX_DB = 6;
const MAX_RATIO = 20;
const BISECTION_STEPS = 24;
const DB_TICKS = [-48, -24, 0];
const describePointer = (point: { x: number; y: number }) =>
  `in ${point.x.toFixed(0)} dB`;
const UNITY = (inputDb: number) => inputDb;

/** The curve of the browser's own compressor node, with no knee, as the pulses are played through it. */
const curveOf = (settings: { ratio: number; thresholdDb: number }) =>
  webAudioCompressorOutput({ ...settings, kneeDb: 0 });

/**
 * The ratio that puts the curve at `outputDb` for the loudest input. The node
 * adds a make-up gain that depends on the ratio, so the level it ends at is
 * not a plain function to invert: it falls as the ratio rises, so bisect.
 */
function ratioFor(thresholdDb: number, outputDb: number) {
  let low = 1;
  let high = MAX_RATIO;
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (curveOf({ ratio: middle, thresholdDb })(MAX_DB) > outputDb) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/**
 * A compressor's transfer curve, the one of the node that plays: one handle
 * sets the threshold, the other how hard the loudest level is held down (the
 * ratio). Below the threshold the line sits above the dashed unity line by the
 * make-up gain the node adds on its own.
 */
export default function PlotCompressorDemo() {
  const [compressor, setCompressor] = useState({ ratio: 4, thresholdDb: -24 });
  const output = useMemo(() => curveOf(compressor), [compressor]);
  const loudest = output(MAX_DB);
  const makeupDb = output(MIN_DB) - MIN_DB;
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
        ratio: ratioFor(current.thresholdDb, y),
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
          {playing ? (
            <IconPlaceholder
              hugeicons="PauseIcon"
              lucide="PauseIcon"
              phosphor="PauseIcon"
              remixicon="RiPauseLine"
              tabler="IconPlayerPause"
            />
          ) : (
            <IconPlaceholder
              hugeicons="PlayIcon"
              lucide="PlayIcon"
              phosphor="PlayIcon"
              remixicon="RiPlayLine"
              tabler="IconPlayerPlay"
            />
          )}
        </Button>
        <output className="font-mono text-muted-foreground text-xs">
          Threshold {compressor.thresholdDb.toFixed(0)} dB,{" "}
          {compressor.ratio.toFixed(1)}:1, make-up +{makeupDb.toFixed(1)} dB
        </output>
      </div>
    </div>
  );
}
