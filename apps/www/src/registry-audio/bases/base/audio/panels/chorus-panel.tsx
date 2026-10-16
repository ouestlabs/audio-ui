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
  type ChorusState,
  chorusDevice,
  chorusSweep,
} from "@/registry-audio/bases/base/lib/chorus-device";

/** Two seconds of the sweep: the slowest rate is a cycle in 20 s, the plot shows what it does meanwhile. */
const WINDOW_SECONDS = 2;
const MAX_MS = 48;
const TIME_TICKS = [0.5, 1, 1.5];
const MS_TICKS = [10, 20, 30, 40];
const SWITCHES = ["enabled"] as const;
const OFF = chorusDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatSeconds = (seconds: number) => `${seconds}s`;
const formatMs = (ms: number) => `${ms}ms`;

interface ChorusPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: ChorusState) => void;
  value: ChorusState;
}

/**
 * The face of the chorus device: the delay time as the oscillator sweeps it
 * over two seconds, over its knobs. Controlled like `DevicePanel`, which it
 * uses for them. Its children sit at the end of the title bar.
 */
function ChorusPanel({
  children,
  className,
  onValueChange,
  value,
}: ChorusPanelProps) {
  const sweep = useMemo(() => chorusSweep(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={chorusDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="chorus-panel"
      >
        <Plot
          aria-label="Delay time over two seconds"
          className="min-h-40 grow"
          maxX={WINDOW_SECONDS}
          maxY={MAX_MS}
          minX={0}
          minY={0}
        >
          <PlotGraph>
            <PlotCurve fn={sweep} />
          </PlotGraph>
          <PlotGrid
            x={{ format: formatSeconds, ticks: TIME_TICKS }}
            y={{ format: formatMs, ticks: MS_TICKS }}
          />
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={chorusDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ChorusPanel };
