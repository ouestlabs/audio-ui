"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type DuckerState,
  duckerCurve,
  duckerDevice,
} from "@/registry-audio/bases/base/devices/ducker/device";

const MIN_KEY_DB = -60;
const MAX_KEY_DB = 0;
const MIN_GAIN_DB = -48;
const MAX_GAIN_DB = 6;
const KEY_TICKS = [-48, -24, 0];
const GAIN_TICKS = [-36, -24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = duckerDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface DuckerPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DuckerState) => void;
  value: DuckerState;
}

/**
 * The face of the ducker device: the gain it puts on the sound for each level
 * of the key, with the threshold, a handle on it to drag across and the range
 * it never goes under, over the knobs. Controlled like `DevicePanel`, which it
 * uses for the knobs. Its children sit at the end of the title bar.
 */
function DuckerPanel({
  children,
  className,
  onValueChange,
  value,
}: DuckerPanelProps) {
  const curve = useMemo(() => duckerCurve(value), [value]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(duckerDevice.apply(value, { thresholdDb: x }).state),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={duckerDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="ducker-panel"
      >
        <Plot
          aria-label="Gain on the sound for the level of the key"
          className="h-28 min-h-16 grow"
          maxX={MAX_KEY_DB}
          maxY={MAX_GAIN_DB}
          minX={MIN_KEY_DB}
          minY={MIN_GAIN_DB}
        >
          <PlotGrid x={{ ticks: KEY_TICKS }} y={{ ticks: GAIN_TICKS }} />
          <PlotGraph>
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.thresholdDb}
            />
            <PlotLine
              axis="y"
              className="stroke-foreground/40 [stroke-dasharray:2_3]"
              value={-value.rangeDb}
            />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Threshold"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.thresholdDb, y: curve(value.thresholdDb) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={duckerDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { DuckerPanel };
