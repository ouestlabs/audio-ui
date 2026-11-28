import { type ReactNode, useCallback, useMemo } from "react";
import {
  Plot,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/registry/bases/shared/audio-ui/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio-ui/panels/device-panel";
import {
  type DuckerState,
  duckerCurve,
  duckerDevice,
} from "@/registry/bases/shared/devices/ducker/device";
import {
  curveDot,
  type DeviceSignal,
} from "@/registry/lib/devices/device-signal";
import { cn } from "@/registry/lib/utils";

const MIN_KEY_DB = -60;
const MAX_KEY_DB = 0;
const MIN_GAIN_DB = -48;
const MAX_GAIN_DB = 6;
const KEY_TICKS = [-48, -24, 0];
const GAIN_TICKS = [-36, -24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = duckerDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface DuckerPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DuckerState) => void;
  /** Called once a change is done, with the state and the parameter's id: where a host ends an automation gesture. */
  onValueCommitted?: (state: DuckerState, id: keyof DuckerState) => void;
  /** Its live sound: a dot rides the curve at the level of the key it ducks for. */
  signal?: DeviceSignal;
  value: DuckerState;
}

/**
 * The face of the ducker device: the gain it puts on the sound for each level
 * of the key, with the threshold, a handle on it to drag across and the range
 * it never goes under, over the knobs. Controlled like `DevicePanel`, which it
 * uses for the knobs. Its children sit at the end of the title bar.
 */
function DuckerPanel({
  children,
  className,
  onValueChange,
  onValueCommitted,
  signal,
  value,
}: DuckerPanelProps) {
  const curve = useMemo(() => duckerCurve(value), [value]);
  // The dot rides the curve at the level of the key, the louder of its channels: how far it ducks the sound now.
  const dot = useMemo(() => {
    const levels = signal?.key?.levels;
    return levels && curveDot(levels, curve);
  }, [curve, signal]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(duckerDevice.apply(value, { thresholdDb: x }).state),
    [onValueChange, value]
  );
  const commit = useCallback(
    ({ x }: { x: number }) =>
      onValueCommitted?.(
        duckerDevice.apply(value, { thresholdDb: x }).state,
        "thresholdDb"
      ),
    [onValueCommitted, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={duckerDevice}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="ducker-panel"
      >
        <Plot
          aria-label="Gain on the sound for the level of the key"
          className="h-28 min-h-16 grow"
          maxX={MAX_KEY_DB}
          maxY={MAX_GAIN_DB}
          minX={MIN_KEY_DB}
          minY={MIN_GAIN_DB}
        >
          <PlotGrid x={{ ticks: KEY_TICKS }} y={{ ticks: GAIN_TICKS }} />
          <PlotGraph>
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.thresholdDb}
            />
            <PlotLine
              axis="y"
              className="stroke-foreground/40 [stroke-dasharray:2_3]"
              value={-value.rangeDb}
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
              onValueCommitted={commit}
              value={{ x: value.thresholdDb, y: curve(value.thresholdDb) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={duckerDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { DuckerPanel };
