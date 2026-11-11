"use client";

import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type TiltEqState,
  tiltEqCurve,
  tiltEqDevice,
} from "@/registry-audio/bases/base/devices/tilt-eq/device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MAX_DB = 18;
const DB_TICKS = [-12, 0, 12];
const SWITCHES = ["enabled"] as const;
const OFF = tiltEqDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;

interface TiltEqPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: TiltEqState) => void;
  value: TiltEqState;
}

/**
 * The face of the tilt EQ device: the curve it plays, tilted around a line at
 * the pivot, over its knobs. Controlled like `DevicePanel`, which it uses for
 * them. Its children sit at the end of the title bar.
 */
function TiltEqPanel({
  children,
  className,
  onValueChange,
  value,
}: TiltEqPanelProps) {
  const curve = useMemo(() => tiltEqCurve(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={tiltEqDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="tilt-eq-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={-MAX_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ count: 6 }}
            y={{ format: formatDbMark, ticks: DB_TICKS }}
          />
          <PlotGraph>
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.pivotHz}
            />
            <PlotArea fillTo={0} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={tiltEqDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { TiltEqPanel };
