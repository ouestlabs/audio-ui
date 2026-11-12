import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import { type ReactNode, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type ExciterState,
  exciterBand,
  exciterDevice,
} from "@/components/audio-ui/devices/exciter/device";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/components/audio-ui/plot";
import { cn } from "@/lib/utils";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 12;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = exciterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;

interface ExciterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: ExciterState) => void;
  value: ExciterState;
}

/**
 * The face of the exciter device: the band of highs it makes its harmonics
 * from, over its knobs. Controlled like `DevicePanel`, which it uses for them.
 * Its children sit at the end of the title bar.
 */
function ExciterPanel({
  children,
  className,
  onValueChange,
  value,
}: ExciterPanelProps) {
  const band = useMemo(() => exciterBand(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={exciterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="exciter-panel"
      >
        <Plot
          aria-label="The band it excites"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid x={{ count: 6 }} y={{ ticks: DB_TICKS }} />
          <PlotGraph>
            <PlotArea fillTo={MIN_DB} fn={band} />
            <PlotCurve fn={band} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={exciterDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ExciterPanel };
