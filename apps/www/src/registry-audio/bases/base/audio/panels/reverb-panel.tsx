"use client";

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
  DECAY_DB,
  type ReverbState,
  reverbDecay,
  reverbDevice,
} from "@/registry-audio/bases/base/lib/reverb-device";

/** How much time the plot shows: the longest decay is 10 s, after the longest pre-delay. */
const WINDOW_SECONDS = 10.5;
const TIME_TICKS = [2, 4, 6, 8, 10];
const DB_TICKS = [-48, -24, 0];
const SWITCHES = ["enabled"] as const;
const OFF = reverbDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatSeconds = (seconds: number) => `${seconds}s`;
const describePointer = (point: { x: number; y: number }) =>
  `${point.x.toFixed(1)} s · ${Math.round(point.y)} dB`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? `${value.toFixed(1)} s` : `${Math.round(value)} dB`;

interface ReverbPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: ReverbState) => void;
  value: ReverbState;
}

/**
 * The face of the reverb device: the tail it makes, its level in dB falling
 * from the end of the pre-delay to -60 dB, with a handle where it ends: drag it
 * along for the decay time. The knobs under it are the same parameters, with
 * the pre-delay, the damping and the mix. Controlled like `DevicePanel`, which
 * it uses for the knobs. Its children sit at the end of the title bar.
 */
function ReverbPanel({
  children,
  className,
  onValueChange,
  value,
}: ReverbPanelProps) {
  const decay = useMemo(() => reverbDecay(value), [value]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(
        reverbDevice.set(value, "decay", x - value.preDelayMs / 1000)
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={reverbDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="reverb-panel"
      >
        <Plot
          aria-label="Decay of the tail"
          className="h-28 min-h-24 grow"
          maxX={WINDOW_SECONDS}
          maxY={0}
          minX={0}
          minY={DECAY_DB}
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ format: formatSeconds, ticks: TIME_TICKS }}
            y={{ ticks: DB_TICKS }}
          />
          <PlotGraph>
            <PlotArea fillTo={DECAY_DB} fn={decay} />
            <PlotCurve fn={decay} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Decay time"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.preDelayMs / 1000 + value.decay, y: DECAY_DB }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={reverbDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ReverbPanel };
