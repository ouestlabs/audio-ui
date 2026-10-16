"use client";

import type { Source } from "@audio-ui/react";
import { useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { DevicePanel } from "@/registry-audio/bases/base/audio/elements/device-panel";
import {
  Plot,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  type CompressorState,
  compressorCurve,
  compressorDevice,
} from "@/registry-audio/bases/base/lib/compressor-device";

const MIN_DB = -60;
const MAX_DB = 6;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
const _describePointer = (point: { x: number; y: number }) =>
  `in ${point.x.toFixed(0)} dB`;

interface CompressorPanelProps {
  className?: string;
  /** The level going in, in dB, as a live source: a dot rides the curve at it. */
  level?: Source<number>;
  onValueChange: (state: CompressorState) => void;
  value: CompressorState;
}

/**
 * The face of the compressor device: the transfer curve it plays, with the
 * threshold and the level going in on it, over the device's own knobs. It is
 * controlled like `DevicePanel`, which it uses for the knobs: drawing the curve
 * is all it adds.
 */
function CompressorPanel({
  className,
  level,
  onValueChange,
  value,
}: CompressorPanelProps) {
  const output = useMemo(() => compressorCurve(value), [value]);
  const dot = useMemo(
    () =>
      level && {
        getSnapshot: () => {
          const x = level.getSnapshot();
          return { x, y: output(x) };
        },
        subscribe: level.subscribe,
      },
    [level, output]
  );
  return (
    <div
      className={cn("flex w-full flex-col gap-4", className)}
      data-slot="compressor-panel"
    >
      <Plot
        aria-label="Transfer curve"
        className="h-40"
        maxX={MAX_DB}
        maxY={MAX_DB}
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
            value={value.thresholdDb}
          />
          <PlotCurve fn={output} />
        </PlotGraph>
        <PlotGrid x={{ ticks: DB_TICKS }} y={{ ticks: DB_TICKS.slice(0, 2) }} />
        {dot ? <PlotDot source={dot} /> : null}
      </Plot>
      <DevicePanel
        device={compressorDevice}
        onValueChange={onValueChange}
        value={value}
      />
    </div>
  );
}

export { CompressorPanel };
