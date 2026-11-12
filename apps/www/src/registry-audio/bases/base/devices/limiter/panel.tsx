import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type LimiterState,
  limiterCurve,
  limiterDevice,
} from "@/registry-audio/bases/base/devices/limiter/device";

const MIN_DB = -48;
const MAX_DB = 0;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
const IN_THE_TITLE_BAR = ["enabled"] as const;
const OFF = limiterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface LimiterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: LimiterState) => void;
  value: LimiterState;
}

/**
 * The face of the limiter device: its transfer curve against the straight line of a clean sound, with a handle
 * where the limiting starts: drag it up and down for the ceiling and across
 * for the input gain, over the knobs.
 * Controlled like `DevicePanel`, which it uses for the knobs. Its children sit
 * at the end of the title bar.
 */
function LimiterPanel({
  children,
  className,
  onValueChange,
  value,
}: LimiterPanelProps) {
  const curve = useMemo(() => limiterCurve(value), [value]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        limiterDevice.apply(value, { ceilingDb: y, gainDb: y - x }).state
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={limiterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="limiter-panel"
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
            // Only -24 up the side: -48 would sit on the row of the figures along the bottom.
            y={{ ticks: DB_TICKS.slice(1, 2) }}
          />
          <PlotGraph>
            <PlotCurve
              className="stroke-border [stroke-dasharray:4_4]"
              fn={UNITY}
            />
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.ceilingDb - value.gainDb}
            />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Ceiling and gain"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.ceilingDb - value.gainDb, y: value.ceilingDb }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={limiterDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { LimiterPanel };
