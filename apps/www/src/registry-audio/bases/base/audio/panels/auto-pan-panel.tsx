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
  type AutoPanState,
  autoPanDevice,
  autoPanSweep,
} from "@/registry-audio/bases/base/lib/auto-pan-device";

/** Two seconds of the oscillator, whatever the rate: the plot shows what it does meanwhile. */
const WINDOW_SECONDS = 2;
const TIME_TICKS = [0.5, 1, 1.5];
const PERCENT_TICKS = [-50, 0, 50];
const SWITCHES = ["enabled"] as const;
const SYNCED_OFF = ["rateHz"] as const;
const FREE_OFF = ["division"] as const;
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
  /** The host's tempo, which a synced rate is read against. @default 120 BPM */
  tempo?: Tempo;
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
  tempo = DEFAULT_TEMPO,
  value,
}: AutoPanPanelProps) {
  const sweep = useMemo(() => autoPanSweep(value, tempo), [tempo, value]);
  let unused: readonly (typeof ALL)[number][] = ALL;
  if (value.enabled) {
    unused = value.sync ? SYNCED_OFF : FREE_OFF;
  }
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
          className="grid-cols-3"
          device={autoPanDevice}
          disabled={unused}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { AutoPanPanel };
