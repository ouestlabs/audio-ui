"use client";

import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
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
} from "@/registry-audio/bases/base/lib/distortion-device";

const TICKS = [-0.5, 0, 0.5];
const UNITY = (input: number) => input;
const SWITCHES = ["enabled"] as const;
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
 * input from -1 to 1 against the straight line of a clean sound, over its
 * knobs. Controlled like `DevicePanel`, which it uses for them. Its children
 * sit at the end of the title bar.
 */
function DistortionPanel({
  children,
  className,
  onValueChange,
  value,
}: DistortionPanelProps) {
  const curve = useMemo(() => distortionCurve(value), [value]);
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
        <DevicePanel
          className="grid-cols-4"
          device={distortionDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { DistortionPanel };
