"use client";

import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import { type ReactNode, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type BassEnhancerState,
  bassEnhancerBands,
  bassEnhancerDevice,
} from "@/components/audio-ui/devices/bass-enhancer/device";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/components/audio-ui/plot";
import { cn } from "@/lib/utils";

const MIN_HZ = 20;
const MAX_HZ = 2000;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = bassEnhancerDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;

interface BassEnhancerPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: BassEnhancerState) => void;
  value: BassEnhancerState;
}

/**
 * The face of the bass enhancer device: the sub it takes, dashed, and the band
 * above it its harmonics go to, over its knobs. Controlled like `DevicePanel`,
 * which it uses for them. Its children sit at the end of the title bar.
 */
function BassEnhancerPanel({
  children,
  className,
  onValueChange,
  value,
}: BassEnhancerPanelProps) {
  const bands = useMemo(() => bassEnhancerBands(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={bassEnhancerDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="bass-enhancer-panel"
      >
        <Plot
          aria-label="The sub it takes and where its harmonics go"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid x={{ count: 4 }} y={{ ticks: DB_TICKS }} />
          <PlotGraph>
            <PlotCurve
              className="stroke-muted-foreground [stroke-dasharray:4_4]"
              fn={bands.sub}
            />
            <PlotArea fillTo={MIN_DB} fn={bands.harmonics} />
            <PlotCurve fn={bands.harmonics} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={bassEnhancerDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { BassEnhancerPanel };
