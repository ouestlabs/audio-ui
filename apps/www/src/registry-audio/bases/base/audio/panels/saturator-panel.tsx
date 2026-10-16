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
  type SaturatorState,
  saturatorCurve,
  saturatorDevice,
} from "@/registry-audio/bases/base/lib/saturator-device";

const TICKS = [-0.5, 0, 0.5];
const UNITY = (input: number) => input;
const SWITCHES = ["enabled"] as const;
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
        className="flex min-h-0 grow flex-col gap-4 p-3"
        data-slot="saturator-panel"
      >
        <Plot
          aria-label="Transfer curve"
          className="min-h-40 grow"
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
          device={saturatorDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { SaturatorPanel };
