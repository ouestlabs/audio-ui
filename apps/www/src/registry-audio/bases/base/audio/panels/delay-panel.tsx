"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCursor,
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
  type DelayState,
  delayDevice,
  delayTaps,
} from "@/registry-audio/bases/base/lib/delay-device";

/** How much time the plot shows, from the dry sound on: the longest echo time is 2 s. */
const WINDOW_MS = 3000;
const TIME_TICKS = [500, 1000, 2000];
const PERCENT_TICKS = [25, 50, 75];
const SWITCHES = ["enabled"] as const;

const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
const describePointer = (point: { x: number; y: number }) =>
  `${formatMs(point.x)} · ${Math.round(point.y)} %`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatMs(value) : `${Math.round(value)} %`;
const formatPercentMark = (percent: number) => `${percent}%`;

interface DelayPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DelayState) => void;
  value: DelayState;
}

/**
 * The face of the delay device: the echoes it makes, one line each, fainter as
 * they fade, with a handle on the first: drag it across for the time and up for
 * the feedback. The knobs under it are the same parameters, for a precise value.
 * Controlled like `DevicePanel`, which it uses for the knobs. Its children sit
 * at the end of the title bar.
 */
function DelayPanel({
  children,
  className,
  onValueChange,
  value,
}: DelayPanelProps) {
  const taps = useMemo(() => delayTaps(value, WINDOW_MS), [value]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(delayDevice.apply(value, { feedback: y, timeMs: x }).state),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={delayDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="delay-panel"
      >
        <Plot
          aria-label="Echoes"
          className="min-h-40 grow"
          maxX={WINDOW_MS}
          maxY={100}
          minX={0}
          minY={0}
        >
          <PlotCursor format={describePointer} />
          <PlotGraph>
            {taps.map((tap) => (
              <PlotLine
                axis="x"
                className="stroke-primary"
                key={tap.timeMs}
                style={{ opacity: Math.max(0.15, Math.sqrt(tap.level)) }}
                value={tap.timeMs}
              />
            ))}
          </PlotGraph>
          <PlotGrid
            x={{ format: formatMs, ticks: TIME_TICKS }}
            y={{ format: formatPercentMark, ticks: PERCENT_TICKS }}
          />
          {value.enabled ? (
            <PlotHandle
              aria-label="Time and feedback"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.timeMs, y: value.feedback }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={delayDevice}
          disabled={value.enabled ? undefined : ALL_BUT_SWITCH}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

const ALL_BUT_SWITCH = delayDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

export { DelayPanel };
