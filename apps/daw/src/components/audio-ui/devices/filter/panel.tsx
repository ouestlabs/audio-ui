"use client";

import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import type { Source } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/audio-ui/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  CIRCUIT_TYPES,
  DRIVEN_CIRCUITS,
  type FilterCircuit,
  type FilterState,
  filterCircuit,
  filterCurve,
  filterDevice,
  resonanceDb,
  resonanceFromDb,
} from "@/components/audio-ui/devices/filter/device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 30;
const DB_TICKS = [-24, 0, 24];
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const IN_THE_TITLE_BAR = ["enabled", "circuit"] as const;
const OFF = filterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");
/** The SEM has no drive to bend them. */
const UNDRIVEN_OFF = ["driveDb"] as const;
const CIRCUITS =
  filterDevice.parameters.find((parameter) => parameter.id === "circuit")
    ?.options ?? [];

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
 * cutoff: drag it across for the frequency and up for the resonance. The
 * circuit is picked in the title bar, those without the type greyed out, and
 * the curve is the one that circuit plays. The type is a list of buttons, and
 * the knobs under it are the same parameters, for a precise value, the drive
 * for a circuit it bends. Controlled like `DevicePanel`, which it uses for them. Its
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
  const pickCircuit = useCallback(
    (circuit: string | null) => {
      if (circuit) {
        onValueChange(filterDevice.set(value, "circuit", circuit));
      }
    },
    [onValueChange, value]
  );
  const played = filterCircuit(value);
  let disabled: readonly (typeof OFF)[number][] | undefined;
  if (!value.enabled) {
    disabled = OFF;
  } else if (!DRIVEN_CIRCUITS.includes(played)) {
    disabled = UNDRIVEN_OFF;
  }
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={filterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select
          disabled={!value.enabled}
          items={CIRCUITS}
          onValueChange={pickCircuit}
          value={played}
        >
          <SelectTrigger
            aria-label="Circuit"
            className="w-28 data-[size=sm]:h-6"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CIRCUITS.map((circuit) => (
                <SelectItem
                  disabled={
                    !CIRCUIT_TYPES[circuit.value as FilterCircuit].includes(
                      value.type
                    )
                  }
                  key={circuit.value}
                  value={circuit.value}
                >
                  {circuit.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="filter-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="h-28 min-h-16 grow"
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
          className="grid-cols-4"
          device={filterDevice}
          disabled={disabled}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { FilterPanel };