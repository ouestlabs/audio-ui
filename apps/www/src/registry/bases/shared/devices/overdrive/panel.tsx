import { type ReactNode, useCallback, useMemo } from "react";
import { formatFrequency, formatLevel } from "@/engine/format";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotTraceArea,
} from "@/registry/bases/shared/audio-ui/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio-ui/panels/device-panel";
import {
  type OverdriveState,
  overdriveBand,
  overdriveDevice,
} from "@/registry/bases/shared/devices/overdrive/device";
import type { DeviceSignal } from "@/registry/lib/device-signal";
import { cn } from "@/registry/lib/utils";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = overdriveDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) =>
  formatLevel(db, "dB", { decimals: 0, unit: false });
const describePointer = (point: { x: number; y: number }) =>
  `${formatFrequency(point.x)} · ${formatLevel(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatFrequency(value) : formatLevel(value);
const getAriaLabel = (axis: "x" | "y") => (axis === "x" ? "Band" : "Level");

interface OverdrivePanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: OverdriveState) => void;
  /** Its live sound: the spectrum of what comes out, behind the band that reaches the clip. */
  signal?: DeviceSignal;
  value: OverdriveState;
}

/**
 * The face of the overdrive device: the band-pass that picks what is pushed
 * into the clip, with a handle on its centre to drag across for the frequency.
 * The width, the drive, the tone and the mix are the knobs under it.
 * Controlled like `DevicePanel`, which it uses for them. Its children sit at
 * the end of the title bar.
 */
function OverdrivePanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: OverdrivePanelProps) {
  const spectrum = useMemo(
    () => signal?.output.spectrum({ maxHz: MAX_HZ, minHz: MIN_HZ }),
    [signal]
  );
  const band = useMemo(() => overdriveBand(value), [value]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(overdriveDevice.set(value, "bandHz", x)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={overdriveDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="overdrive-panel"
      >
        <Plot
          aria-label="Band that reaches the clip"
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
            <PlotArea fillTo={MIN_DB} fn={band} />
            <PlotCurve fn={band} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Band centre"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.bandHz, y: band(value.bandHz) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-5"
          device={overdriveDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { OverdrivePanel };
