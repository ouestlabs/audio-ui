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
  type ReduxState,
  reduxCurve,
  reduxDevice,
} from "@/registry-audio/bases/base/lib/redux-device";

const TICKS = [-0.5, 0, 0.5];
const UNITY = (input: number) => input;
const SWITCHES = ["enabled"] as const;
const OFF = reduxDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

interface ReduxPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: ReduxState) => void;
  value: ReduxState;
}

/**
 * The face of the redux device: the stairs the bits make, each input from -1
 * to 1 against the straight line of a clean sound, over its knobs. Controlled
 * like `DevicePanel`, which it uses for them. Its children sit at the end of
 * the title bar.
 */
function ReduxPanel({
  children,
  className,
  onValueChange,
  value,
}: ReduxPanelProps) {
  const curve = useMemo(() => reduxCurve(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={reduxDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="redux-panel"
      >
        <Plot
          aria-label="Quantizer"
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
          className="grid-cols-3"
          device={reduxDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ReduxPanel };
