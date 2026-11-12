import { type ReactNode, useCallback, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type GateState,
  gateCurve,
  gateDevice,
} from "@/components/audio-ui/devices/gate/device";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/components/audio-ui/plot";
import { cn } from "@/lib/utils";

const MIN_DB = -80;
const MAX_DB = 0;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
const IN_THE_TITLE_BAR = ["enabled"] as const;
const OFF = gateDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface GatePanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: GateState) => void;
  value: GateState;
}

/**
 * The face of the gate device: its transfer curve against the straight line
 * of a clean sound, with a handle on the threshold to drag across and a line
 * where it closes, over the knobs.
 * Controlled like `DevicePanel`, which it uses for the knobs. Its children sit
 * at the end of the title bar.
 */
function GatePanel({
  children,
  className,
  onValueChange,
  value,
}: GatePanelProps) {
  const curve = useMemo(() => gateCurve(value), [value]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(gateDevice.apply(value, { thresholdDb: x }).state),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={gateDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="gate-panel"
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
            y={{ ticks: DB_TICKS.slice(0, 2) }}
          />
          <PlotGraph>
            <PlotCurve
              className="stroke-border [stroke-dasharray:4_4]"
              fn={UNITY}
            />
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.thresholdDb}
            />
            <PlotLine
              axis="x"
              className="stroke-foreground/40 [stroke-dasharray:2_3]"
              value={value.thresholdDb - value.hysteresisDb}
            />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Threshold"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.thresholdDb, y: value.thresholdDb }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={gateDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { GatePanel };
