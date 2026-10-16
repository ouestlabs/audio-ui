"use client";

import { formatDb } from "@audio-ui/core/analysis";
import { type ReactNode, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
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
  type TransientState,
  transientDevice,
} from "@/registry-audio/bases/base/lib/transient-device";

const LIMIT_DB = 12;
const TICKS = [-12, 0, 12];
const SWITCHES = ["enabled"] as const;
const OFF = transientDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describeValue = (value: number) => formatDb(value);
const getAriaLabel = (axis: "x" | "y") => (axis === "x" ? "Sustain" : "Attack");

interface TransientPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: TransientState) => void;
  value: TransientState;
}

/**
 * The face of the transient shaper device: a square with the sustain across
 * and the attack up, and a handle to drag to both at once. The centre is a
 * sound left as it is. The output is the knob under it. Controlled like
 * `DevicePanel`, which it uses for the knobs. Its children sit at the end of
 * the title bar.
 */
function TransientPanel({
  children,
  className,
  onValueChange,
  value,
}: TransientPanelProps) {
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        transientDevice.apply(value, { attackDb: y, sustainDb: x }).state
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={transientDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="transient-panel"
      >
        <Plot
          aria-label="Attack and sustain"
          className="h-28 min-h-24 grow"
          maxX={LIMIT_DB}
          maxY={LIMIT_DB}
          minX={-LIMIT_DB}
          minY={-LIMIT_DB}
        >
          <PlotGrid
            x={{ format: formatMark, ticks: TICKS }}
            y={{ format: formatMark, ticks: TICKS }}
          />
          <PlotGraph>
            <PlotLine axis="x" className="stroke-foreground/40" value={0} />
            <PlotLine axis="y" className="stroke-foreground/40" value={0} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Attack and sustain"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.sustainDb, y: value.attackDb }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          device={transientDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { TransientPanel };
