"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { CurveSelect } from "@/registry-audio/bases/base/audio/elements/curve-select";
import {
  Plot,
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
  type SaturatorState,
  saturate,
  saturatorCurve,
  saturatorDevice,
} from "@/registry-audio/bases/base/lib/saturator-device";

const TICKS = [-0.5, 0, 0.5];
const UNITY = (input: number) => input;
const SWITCHES = ["enabled", "curve"] as const;
const [, CURVE] = saturatorDevice.parameters;

/** What each curve does to an input, from the device itself: the buttons are drawn from it. */
const shapeOf = (curve: string, input: number) =>
  saturate(curve as SaturatorState["curve"], input);
const OFF = saturatorDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

interface SaturatorPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: SaturatorState) => void;
  value: SaturatorState;
}

/**
 * The face of the saturator device: its transfer curve, the output for each
 * input from -1 to 1 against the straight line of a clean sound, over its
 * knobs and the choice of the curve. Controlled like `DevicePanel`, which it uses for them. Its children
 * sit at the end of the title bar.
 */
function SaturatorPanel({
  children,
  className,
  onValueChange,
  value,
}: SaturatorPanelProps) {
  const curve = useMemo(() => saturatorCurve(value), [value]);
  const pickCurve = useCallback(
    (next: string) => onValueChange(saturatorDevice.set(value, "curve", next)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={saturatorDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="saturator-panel"
      >
        <Plot
          aria-label="Transfer curve"
          className="h-28 min-h-24 grow"
          maxX={1}
          maxY={1}
          minX={-1}
          minY={-1}
        >
          <PlotGrid x={{ ticks: TICKS }} y={{ ticks: TICKS }} />
          <PlotGraph>
            <PlotCurve
              className="stroke-border [stroke-dasharray:4_4]"
              fn={UNITY}
            />
            <PlotCurve fn={curve} />
          </PlotGraph>
        </Plot>
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-3">
          <div className="flex flex-col items-center gap-1.5">
            <span aria-hidden="true" className="text-muted-foreground text-xs">
              {CURVE.label}
            </span>
            <CurveSelect
              aria-label={CURVE.label}
              className="grid w-auto grid-cols-2 gap-1"
              disabled={!value.enabled}
              onValueChange={pickCurve}
              options={CURVE.options}
              shape={shapeOf}
              value={value.curve}
            />
          </div>
          <DevicePanel
            className="grid-cols-3"
            device={saturatorDevice}
            disabled={value.enabled ? undefined : OFF}
            exclude={SWITCHES}
            onValueChange={onValueChange}
            value={value}
          />
        </div>
      </div>
    </DeviceFrame>
  );
}

export { SaturatorPanel };
