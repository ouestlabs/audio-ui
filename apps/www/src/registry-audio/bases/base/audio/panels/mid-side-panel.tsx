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
  type MidSideState,
  midSideDevice,
} from "@/registry-audio/bases/base/lib/mid-side-device";

const MIN_DB = -24;
const MAX_DB = 12;
const TICKS = [-12, 0, 12];
const SWITCHES = ["enabled"] as const;
const OFF = midSideDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describeValue = (value: number) => formatDb(value);
const getAriaLabel = (axis: "x" | "y") => (axis === "x" ? "Side" : "Mid");

interface MidSidePanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: MidSideState) => void;
  value: MidSideState;
}

/**
 * The face of the mid/side device: a square with the side level across and the
 * mid level up, and a handle to drag to both at once. The crossing of the two
 * lines is a signal left as it is. Bass mono is the knob under it. Controlled
 * like `DevicePanel`, which it uses for the knobs. Its children sit at the end
 * of the title bar.
 */
function MidSidePanel({
  children,
  className,
  onValueChange,
  value,
}: MidSidePanelProps) {
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(midSideDevice.apply(value, { midDb: y, sideDb: x }).state),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={midSideDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="mid-side-panel"
      >
        <Plot
          aria-label="Mid and side levels"
          className="h-28 min-h-24 grow"
          maxX={MAX_DB}
          maxY={MAX_DB}
          minX={MIN_DB}
          minY={MIN_DB}
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
              aria-label="Mid and side"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.sideDb, y: value.midDb }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          device={midSideDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { MidSidePanel };
