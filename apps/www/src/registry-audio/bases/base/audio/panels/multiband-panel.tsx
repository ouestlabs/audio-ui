"use client";

import { formatDb, formatHz } from "@audio-ui/core/analysis";
import type { Source } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotTraceArea,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type MultibandState,
  multibandBands,
  multibandDevice,
} from "@/registry-audio/bases/base/lib/multiband-device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
/** The splits are set by the handles on the plot, so they have no knob. */
const HIDDEN = ["enabled", "lowHz", "highHz"] as const;
const OFF = multibandDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");
/** What the knobs gather: each band, the timing, the output. */
const GROUPS = [
  { label: "Low", parameters: ["lowThresholdDb", "lowRatio"] },
  { label: "Mid", parameters: ["midThresholdDb", "midRatio"] },
  { label: "High", parameters: ["highThresholdDb", "highRatio"] },
  { label: "Time", parameters: ["attackMs", "releaseMs"] },
  { label: "Output", parameters: ["outputDb"] },
] as const;

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);
const getAriaLabel = (axis: "x" | "y") => (axis === "x" ? "Split" : "Level");

interface MultibandPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: MultibandState) => void;
  /** A live spectrum behind the curve, such as from `useSpectrum`. */
  spectrum?: Source<Float32Array>;
  value: MultibandState;
}

/**
 * The face of the multiband compressor device: the three bands the signal is
 * split into, drawn against frequency, with a handle on each split to drag
 * across for the splits. Each band's threshold and ratio, the timing and the
 * output are the knobs under it. Controlled like `DevicePanel`, which it uses for them. Its
 * children sit at the end of the title bar.
 */
function MultibandPanel({
  children,
  className,
  onValueChange,
  spectrum,
  value,
}: MultibandPanelProps) {
  const bands = useMemo(() => multibandBands(value), [value]);
  const changeLow = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(multibandDevice.set(value, "lowHz", x)),
    [onValueChange, value]
  );
  const changeHigh = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(multibandDevice.set(value, "highHz", x)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={multibandDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="multiband-panel"
      >
        <Plot
          aria-label="The three bands"
          className="h-28 min-h-24 grow"
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
            <PlotCurve className="stroke-primary/40" fn={bands.low} />
            <PlotCurve className="stroke-primary/70" fn={bands.mid} />
            <PlotCurve fn={bands.high} />
          </PlotGraph>
          {value.enabled ? (
            <>
              <PlotHandle
                aria-label="Low split"
                getAriaLabel={getAriaLabel}
                getAriaValueText={describeValue}
                onValueChange={changeLow}
                value={{ x: value.lowHz, y: -6 }}
              />
              <PlotHandle
                aria-label="High split"
                getAriaLabel={getAriaLabel}
                getAriaValueText={describeValue}
                onValueChange={changeHigh}
                value={{ x: value.highHz, y: -6 }}
              />
            </>
          ) : null}
        </Plot>
        <DevicePanel
          device={multibandDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={HIDDEN}
          groups={GROUPS}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { MultibandPanel };
