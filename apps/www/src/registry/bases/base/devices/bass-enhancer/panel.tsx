import { formatFrequency, formatLevel } from "@/engine/format";
import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotTraceArea,
} from "@/registry/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/base/audio/panels/device-panel";
import {
  type BassEnhancerState,
  bassEnhancerBands,
  bassEnhancerDevice,
} from "@/registry/bases/base/devices/bass-enhancer/device";
import type { DeviceSignal } from "@/registry/bases/base/lib/device-signal";

const MIN_HZ = 20;
const MAX_HZ = 2000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the plot's. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MIN_DB = -36;
const MAX_DB = 6;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = bassEnhancerDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describePointer = (point: { x: number; y: number }) =>
  `${formatFrequency(point.x)} · ${formatLevel(point.y)}`;

interface BassEnhancerPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: BassEnhancerState) => void;
  /** Its live sound: the spectrum of what comes out, its sub and its harmonics, behind the bands it works on. */
  signal?: DeviceSignal;
  value: BassEnhancerState;
}

/**
 * The face of the bass enhancer device: the sub it takes, dashed, and the band
 * above it its harmonics go to, over its knobs. Controlled like `DevicePanel`,
 * which it uses for them. Its children sit at the end of the title bar.
 */
function BassEnhancerPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: BassEnhancerPanelProps) {
  const spectrum = useMemo(
    () => signal?.output.spectrum({ maxHz: MAX_HZ, minHz: MIN_HZ }),
    [signal]
  );
  const bands = useMemo(() => bassEnhancerBands(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={bassEnhancerDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="bass-enhancer-panel"
      >
        <Plot
          aria-label="The sub it takes and where its harmonics go"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid x={{ count: 4 }} y={{ ticks: DB_TICKS }} />
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
            <PlotCurve
              className="stroke-muted-foreground [stroke-dasharray:4_4]"
              fn={bands.sub}
            />
            <PlotArea fillTo={MIN_DB} fn={bands.harmonics} />
            <PlotCurve fn={bands.harmonics} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={bassEnhancerDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { BassEnhancerPanel };
