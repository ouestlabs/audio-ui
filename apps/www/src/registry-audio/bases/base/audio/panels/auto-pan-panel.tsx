"use client";

import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type AutoPanState,
  autoPanDevice,
  autoPanSweep,
} from "@/registry-audio/bases/base/lib/auto-pan-device";

/** Two seconds of the oscillator, whatever the rate: the plot shows what it does meanwhile. */
const WINDOW_SECONDS = 2;
const TIME_TICKS = [0.5, 1, 1.5];
const PERCENT_TICKS = [-50, 0, 50];
const SWITCHES = ["enabled"] as const;
const ALL = autoPanDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatSeconds = (seconds: number) => `${seconds}s`;
const formatPercent = (percent: number) => `${percent}%`;

interface AutoPanPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: AutoPanState) => void;
  value: AutoPanState;
}

/**
 * The face of the auto pan device: what the oscillator does to the pan or the level over two seconds, in its waveform, over its knobs. Controlled like `DevicePanel`, which it uses for them. Its children
 * sit at the end of the title bar.
 */
function AutoPanPanel({
  children,
  className,
  onValueChange,
  value,
}: AutoPanPanelProps) {
  const sweep = useMemo(() => autoPanSweep(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={autoPanDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="auto-pan-panel"
      >
        <Plot
          aria-label="Movement over two seconds"
          className="min-h-40 grow"
          maxX={WINDOW_SECONDS}
          maxY={100}
          minX={0}
          minY={-100}
        >
          <PlotGrid
            x={{ format: formatSeconds, ticks: TIME_TICKS }}
            y={{ format: formatPercent, ticks: PERCENT_TICKS }}
          />
          <PlotGraph>
            <PlotCurve fn={sweep} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={autoPanDevice}
          disabled={value.enabled ? undefined : ALL}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { AutoPanPanel };
