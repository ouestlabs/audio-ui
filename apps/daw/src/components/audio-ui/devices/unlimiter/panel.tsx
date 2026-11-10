"use client";

import { type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotLine,
} from "@/components/audio-ui/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type UnlimiterState,
  unlimiterDevice,
  unlimiterLift,
  unlimiterUnused,
} from "@/components/audio-ui/devices/unlimiter/device";

const MAX_SIZE_DB = 30;
const MAX_LIFT_DB = 18;
const SIZE_TICKS = [10, 20];
const LIFT_TICKS = [6, 12];
const SWITCHES = ["enabled"] as const;
const OFF = unlimiterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDb = (db: number) => `${db} dB`;

interface UnlimiterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: UnlimiterState) => void;
  value: UnlimiterState;
}

/**
 * The face of the unlimiter device: the lift it gives an attack for its size,
 * how far a fast follower of the level rises over a slow one, with the crest
 * an attack is lifted to when it is adaptive, over the knobs and switches,
 * those it does not use drawn off. Controlled like `DevicePanel`, which it
 * uses for them. Its children sit at the end of the title bar.
 */
function UnlimiterPanel({
  children,
  className,
  onValueChange,
  value,
}: UnlimiterPanelProps) {
  const lift = useMemo(() => unlimiterLift(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={unlimiterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="unlimiter-panel"
      >
        <Plot
          aria-label="Lift for the size of an attack"
          className="h-28 min-h-16 grow"
          maxX={MAX_SIZE_DB}
          maxY={MAX_LIFT_DB}
          minX={0}
          minY={0}
        >
          <PlotGrid
            x={{ format: formatDb, ticks: SIZE_TICKS }}
            y={{ format: formatDb, ticks: LIFT_TICKS }}
          />
          <PlotGraph>
            {value.adaptive ? (
              <PlotLine
                axis="x"
                className="stroke-foreground/40"
                value={value.crestDb}
              />
            ) : null}
            <PlotCurve fn={lift} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={unlimiterDevice}
          disabled={value.enabled ? unlimiterUnused(value) : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { UnlimiterPanel };