import { type ReactNode, useMemo } from "react";
import {
  Plot,
  PlotArea,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotTraceArea,
} from "@/registry/bases/shared/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio/panels/device-panel";
import {
  type LofiState,
  lofiCurve,
  lofiDevice,
} from "@/registry/bases/shared/devices/lofi/device";
import type { DeviceSignal } from "@/registry/bases/shared/lib/device-signal";
import { cn } from "@/registry/bases/shared/lib/utils";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the plot's. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = lofiDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

interface LofiPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: LofiState) => void;
  /** Its live sound: the spectrum of what comes out, behind the band it keeps. */
  signal?: DeviceSignal;
  value: LofiState;
}

/**
 * The face of the lo-fi device: the band it leaves, the high-pass under it and
 * the low-pass over it, over its knobs, the wow and the flutter, the hiss and
 * the crackle, the two edges of the band and the drive. Controlled like
 * `DevicePanel`, which it uses for them. Its children sit at the end of the
 * title bar.
 */
function LofiPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: LofiPanelProps) {
  const spectrum = useMemo(
    () => signal?.output.spectrum({ maxHz: MAX_HZ, minHz: MIN_HZ }),
    [signal]
  );
  const curve = useMemo(() => lofiCurve(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={lofiDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="lofi-panel"
      >
        <Plot
          aria-label="Band"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotGrid x={{ count: 6 }} y={{ ticks: DB_TICKS }} />
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
            <PlotArea fillTo={MIN_DB} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={lofiDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { LofiPanel };
