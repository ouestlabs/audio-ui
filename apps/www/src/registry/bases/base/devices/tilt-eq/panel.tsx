import { type ReactNode, useMemo } from "react";
import { formatFrequency, formatLevel } from "@/engine/format";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotLine,
  PlotTraceArea,
} from "@/registry/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/base/audio/panels/device-panel";
import {
  type TiltEqState,
  tiltEqCurve,
  tiltEqDevice,
} from "@/registry/bases/base/devices/tilt-eq/device";
import type { DeviceSignal } from "@/registry/bases/base/lib/device-signal";
import { cn } from "@/registry/bases/base/lib/utils";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the plot's. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MAX_DB = 18;
const DB_TICKS = [-12, 0, 12];
const SWITCHES = ["enabled"] as const;
const OFF = tiltEqDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) =>
  formatLevel(db, "dB", { decimals: 0, unit: false });
const describePointer = (point: { x: number; y: number }) =>
  `${formatFrequency(point.x)} · ${formatLevel(point.y)}`;

interface TiltEqPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: TiltEqState) => void;
  /** Its live sound: the spectrum of what comes out, behind the curve. */
  signal?: DeviceSignal;
  value: TiltEqState;
}

/**
 * The face of the tilt EQ device: the curve it plays, tilted around a line at
 * the pivot, over its knobs. Controlled like `DevicePanel`, which it uses for
 * them. Its children sit at the end of the title bar.
 */
function TiltEqPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: TiltEqPanelProps) {
  const spectrum = useMemo(
    () => signal?.output.spectrum({ maxHz: MAX_HZ, minHz: MIN_HZ }),
    [signal]
  );
  const curve = useMemo(() => tiltEqCurve(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={tiltEqDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="tilt-eq-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={-MAX_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ count: 6 }}
            y={{ format: formatDbMark, ticks: DB_TICKS }}
          />
          <PlotGraph>
            {spectrum ? (
              // What comes out, behind what the device does to it.
              <PlotTraceArea
                fillTo={SPECTRUM_MIN_DB}
                max={SPECTRUM_MAX_DB}
                min={SPECTRUM_MIN_DB}
                source={spectrum}
              />
            ) : null}
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.pivotHz}
            />
            <PlotArea fillTo={0} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={tiltEqDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { TiltEqPanel };
