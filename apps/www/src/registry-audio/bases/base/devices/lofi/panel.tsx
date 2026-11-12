import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type LofiState,
  lofiCurve,
  lofiDevice,
} from "@/registry-audio/bases/base/devices/lofi/device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
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
  value,
}: LofiPanelProps) {
  const curve = useMemo(() => lofiCurve(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
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
