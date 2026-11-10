"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  COMPANDER_POINTS,
  COMPANDER_POINTS_DB,
  type CompanderState,
  companderCurve,
  companderDevice,
} from "@/registry-audio/bases/base/devices/compander/device";

const MIN_DB = -90;
const MAX_DB = 0;
const DB_TICKS = [-60, -30, 0];
const UNITY = (inputDb: number) => inputDb;
const SWITCHES = ["enabled"] as const;
const OFF = companderDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface CompanderPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: CompanderState) => void;
  value: CompanderState;
}

/**
 * The face of the compander device: its transfer curve against the straight
 * line of a clean sound, with a handle on each of its four points, to drag up
 * and down for the level out, over the knobs. Controlled like `DevicePanel`,
 * which it uses for the knobs. Its children sit at the end of the title bar.
 */
function CompanderPanel({
  children,
  className,
  onValueChange,
  value,
}: CompanderPanelProps) {
  const curve = useMemo(() => companderCurve(value), [value]);
  // A handle moves up and down only: its level in says which point it is.
  const movePoint = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      const levels: readonly number[] = COMPANDER_POINTS_DB;
      const id = COMPANDER_POINTS[levels.indexOf(x)];
      if (id) {
        onValueChange(companderDevice.set(value, id, y));
      }
    },
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={companderDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="compander-panel"
      >
        <Plot
          aria-label="Transfer curve"
          className="h-28 min-h-16 grow"
          maxX={MAX_DB}
          maxY={MAX_DB}
          minX={MIN_DB}
          minY={MIN_DB}
        >
          <PlotGrid
            x={{ ticks: DB_TICKS }}
            y={{ ticks: DB_TICKS.slice(0, 2) }}
          />
          <PlotGraph>
            <PlotCurve
              className="stroke-border [stroke-dasharray:4_4]"
              fn={UNITY}
            />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled
            ? COMPANDER_POINTS.map((id, index) => {
                const inDb = COMPANDER_POINTS_DB[index] ?? 0;
                return (
                  <PlotHandle
                    aria-label={`Level out at ${inDb} dB in`}
                    axis="y"
                    getAriaValueText={describeValue}
                    key={id}
                    onValueChange={movePoint}
                    value={{ x: inDb, y: value[id] }}
                  />
                );
              })
            : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={companderDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { CompanderPanel };
