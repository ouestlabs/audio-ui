"use client";

import { formatDb, formatHz } from "@audio-ui/core/analysis";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type OverdriveState,
  overdriveBand,
  overdriveDevice,
} from "@/registry-audio/bases/base/lib/overdrive-device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = overdriveDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);
const getAriaLabel = (axis: "x" | "y") => (axis === "x" ? "Band" : "Level");

interface OverdrivePanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: OverdriveState) => void;
  value: OverdriveState;
}

/**
 * The face of the overdrive device: the band-pass that picks what is pushed
 * into the clip, with a handle on its centre to drag across for the frequency.
 * The width, the drive, the tone and the mix are the knobs under it.
 * Controlled like `DevicePanel`, which it uses for them. Its children sit at
 * the end of the title bar.
 */
function OverdrivePanel({
  children,
  className,
  onValueChange,
  value,
}: OverdrivePanelProps) {
  const band = useMemo(() => overdriveBand(value), [value]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(overdriveDevice.set(value, "bandHz", x)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={overdriveDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="overdrive-panel"
      >
        <Plot
          aria-label="Band that reaches the clip"
          className="min-h-40 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ count: 6 }}
            y={{ format: formatDbMark, ticks: DB_TICKS }}
          />
          <PlotGraph>
            <PlotArea fillTo={MIN_DB} fn={band} />
            <PlotCurve fn={band} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Band centre"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.bandHz, y: band(value.bandHz) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-5"
          device={overdriveDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { OverdrivePanel };
