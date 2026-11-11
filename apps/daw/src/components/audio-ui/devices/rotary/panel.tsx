"use client";

import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import { type ReactNode, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type RotaryState,
  rotaryBands,
  rotaryDevice,
} from "@/components/audio-ui/devices/rotary/device";
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
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = rotaryDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;

interface RotaryPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: RotaryState) => void;
  value: RotaryState;
}

/**
 * The face of the rotary device: the band the drum turns, dashed, and the one
 * the horn turns, split at the crossover, over its speed and its knobs.
 * Controlled like `DevicePanel`, which it uses for them. Its children sit at
 * the end of the title bar.
 */
function RotaryPanel({
  children,
  className,
  onValueChange,
  value,
}: RotaryPanelProps) {
  const bands = useMemo(() => rotaryBands(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={rotaryDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="rotary-panel"
      >
        <Plot
          aria-label="The drum's band and the horn's"
          className="h-24 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid x={{ count: 6 }} y={{ ticks: DB_TICKS }} />
          <PlotGraph>
            <PlotCurve
              className="stroke-muted-foreground [stroke-dasharray:4_4]"
              fn={bands.drum}
            />
            <PlotArea fillTo={MIN_DB} fn={bands.horn} />
            <PlotCurve fn={bands.horn} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={rotaryDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { RotaryPanel };
