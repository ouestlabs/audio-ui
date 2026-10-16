"use client";

import { formatDb, formatHz } from "@audio-ui/core/analysis";
import type { Source } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
  PlotTraceArea,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type FilterState,
  filterCurve,
  filterDevice,
  resonanceDb,
  resonanceFromDb,
} from "@/registry-audio/bases/base/lib/filter-device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 30;
const DB_TICKS = [-24, 0, 24];
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const SWITCHES = ["enabled"] as const;
const OFF = filterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const getAriaLabel = (axis: "x" | "y") =>
  axis === "x" ? "Cutoff" : "Resonance";
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);

interface FilterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: FilterState) => void;
  /** A live spectrum behind the curve, such as from `useSpectrum`. */
  spectrum?: Source<Float32Array>;
  value: FilterState;
}

/**
 * The face of the filter device: the curve it plays, with a handle on the
 * cutoff: drag it across for the frequency and up for the resonance. The type
 * is a list of buttons, and the knobs under it are the same parameters, for a
 * precise value. Controlled like `DevicePanel`, which it uses for them. Its
 * children sit at the end of the title bar.
 */
function FilterPanel({
  children,
  className,
  onValueChange,
  spectrum,
  value,
}: FilterPanelProps) {
  const curve = useMemo(() => filterCurve(value), [value]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        filterDevice.apply(value, {
          cutoffHz: x,
          resonance: resonanceFromDb(Math.max(0, y)),
        }).state
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={filterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="filter-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="min-h-40 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ count: 6 }}
            y={{ format: formatDbMark, ticks: DB_TICKS }}
          />
          <PlotGraph>
            {spectrum ? (
              <PlotTraceArea
                fillTo={SPECTRUM_MIN_DB}
                max={SPECTRUM_MAX_DB}
                min={SPECTRUM_MIN_DB}
                source={spectrum}
              />
            ) : null}
            <PlotLine axis="x" value={value.cutoffHz} />
            <PlotArea fillTo={MIN_DB} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Cutoff and resonance"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.cutoffHz, y: resonanceDb(value.resonance) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={filterDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { FilterPanel };
