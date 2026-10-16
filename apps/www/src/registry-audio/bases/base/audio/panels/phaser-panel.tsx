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
  type PhaserState,
  phaserDevice,
  phaserSweep,
} from "@/registry-audio/bases/base/lib/phaser-device";

/** Two seconds of the oscillator, whatever the rate: the plot shows what it does meanwhile. */
const WINDOW_SECONDS = 2;
const TIME_TICKS = [0.5, 1, 1.5];
const PERCENT_TICKS = [-50, 0, 50];
const SWITCHES = ["enabled"] as const;
const ALL = phaserDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const NO_DELAY = ["delayMs"] as const;
const NO_CENTER = ["centerHz"] as const;

const formatSeconds = (seconds: number) => `${seconds}s`;
const formatPercent = (percent: number) => `${percent}%`;

interface PhaserPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: PhaserState) => void;
  value: PhaserState;
}

/**
 * The face of the phaser-flanger device: what the oscillator does to the swept value over two seconds, over its knobs; the centre goes off in flanger mode and the delay in phaser mode. Controlled like `DevicePanel`, which it uses for them. Its children
 * sit at the end of the title bar.
 */
function PhaserPanel({
  children,
  className,
  onValueChange,
  value,
}: PhaserPanelProps) {
  const sweep = useMemo(() => phaserSweep(value), [value]);
  let unused: readonly (typeof ALL)[number][] = ALL;
  if (value.enabled) {
    unused = value.mode === "phaser" ? NO_DELAY : NO_CENTER;
  }
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={phaserDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="phaser-panel"
      >
        <Plot
          aria-label="Sweep over two seconds"
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
          device={phaserDevice}
          disabled={unused}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { PhaserPanel };
