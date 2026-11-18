import { type ReactNode, useCallback, useMemo } from "react";
import {
  Plot,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/registry/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/base/audio/panels/device-panel";
import {
  type GateState,
  gateCurve,
  gateDevice,
} from "@/registry/bases/base/devices/gate/device";
import {
  curveDot,
  type DeviceSignal,
} from "@/registry/bases/base/lib/device-signal";
import { cn } from "@/registry/bases/base/lib/utils";

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
  /** Its live sound: a dot rides the curve at the level going in. */
  signal?: DeviceSignal;
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
  signal,
  value,
}: GatePanelProps) {
  const curve = useMemo(() => gateCurve(value), [value]);
  // The dot rides the curve at the level going in, the louder of its channels.
  const dot = useMemo(() => {
    const levels = signal?.input?.levels;
    return levels && curveDot(levels, curve);
  }, [curve, signal]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(gateDevice.apply(value, { thresholdDb: x }).state),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
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
          {dot ? (
            // With no sound going in, the dot has no place on the curve.
            <PlotDot className="group-data-idle/device:hidden" source={dot} />
          ) : null}
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
