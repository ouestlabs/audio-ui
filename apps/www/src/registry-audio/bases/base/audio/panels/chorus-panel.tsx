"use client";

import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/core/time";
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
const SYNCED_OFF = ["rateHz"] as const;
const FREE_OFF = ["division"] as const;
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
  /** The host's tempo, which a synced rate is read against. @default 120 BPM */
  tempo?: Tempo;
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
  tempo = DEFAULT_TEMPO,
  value,
}: ChorusPanelProps) {
  const sweep = useMemo(() => chorusSweep(value, tempo), [tempo, value]);
  let unused: readonly (typeof OFF)[number][] = OFF;
  if (value.enabled) {
    unused = value.sync ? SYNCED_OFF : FREE_OFF;
  }
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
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="chorus-panel"
      >
        <Plot
          aria-label="Delay time over two seconds"
          className="h-28 min-h-24 grow"
          maxX={WINDOW_SECONDS}
          maxY={MAX_MS}
          minX={0}
          minY={0}
        >
          <PlotGrid
            x={{ format: formatSeconds, ticks: TIME_TICKS }}
            y={{ format: formatMs, ticks: MS_TICKS }}
          />
          <PlotGraph>
            <PlotCurve fn={sweep} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={chorusDevice}
          disabled={unused}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ChorusPanel };
