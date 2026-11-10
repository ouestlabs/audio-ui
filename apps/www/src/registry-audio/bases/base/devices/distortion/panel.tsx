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
  type DistortionState,
  distortionCurve,
  distortionDevice,
  distortionShape,
} from "@/registry-audio/bases/base/devices/distortion/device";

const TICKS = [-0.5, 0, 0.5];
const UNITY = (input: number) => input;
const SWITCHES = ["enabled", "curve"] as const;
const [, CURVE] = distortionDevice.parameters;

/**
 * What each curve does to an input, from the device itself: the buttons are
 * drawn from it, driven three times over so a clip and a fold both show.
 */
const shapeOf = (curve: string, input: number) =>
  distortionShape(curve as DistortionState["curve"], 3 * input);
const OFF = distortionDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

interface DistortionPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DistortionState) => void;
  value: DistortionState;
}

/**
 * The face of the distortion device: its transfer curve, the output for each
 * input from -1 to 1 against the straight line of a clean sound, over the
 * choice of the curve and its knobs. Controlled like `DevicePanel`, which it
 * uses for them. Its children sit at the end of the title bar.
 */
function DistortionPanel({
  children,
  className,
  onValueChange,
  value,
}: DistortionPanelProps) {
  const curve = useMemo(() => distortionCurve(value), [value]);
  const pickCurve = useCallback(
    (next: string) => onValueChange(distortionDevice.set(value, "curve", next)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={distortionDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="distortion-panel"
      >
        <Plot
          aria-label="Transfer curve"
          className="h-28 min-h-16 grow"
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
            className="grid-cols-4"
            device={distortionDevice}
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

export { DistortionPanel };
