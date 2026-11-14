import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
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
  type StutterState,
  stutterCycle,
  stutterDevice,
} from "@/registry-audio/bases/base/devices/stutter/device";
import type { DeviceSignal } from "@/registry-audio/bases/base/lib/device-signal";

const SWITCHES = ["enabled"] as const;
const OFF = stutterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");
const formatBeats = (beats: number) => `${Number(beats.toFixed(2))}`;

interface StutterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: StutterState) => void;
  /** Its live sound: the level of what comes out over the length of one interval, its slices and their repeats as they play. */
  signal?: DeviceSignal;
  value: StutterState;
}

/**
 * The face of the stutter device: one interval, in beats, the slice it catches
 * and each repeat after it at the level the decay leaves, over its knobs.
 * Controlled like `DevicePanel`, which it uses for them. Its children sit at
 * the end of the title bar.
 */
function StutterPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: StutterPanelProps) {
  const cycle = useMemo(() => stutterCycle(value), [value]);
  const ticks = useMemo(
    () =>
      Array.from(
        { length: Math.min(16, Math.round(cycle.beats / cycle.slice)) },
        (_, index) => index * cycle.slice
      ),
    [cycle]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={stutterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="stutter-panel"
      >
        <Plot
          aria-label="One interval: the slice and its repeats"
          className="h-28 min-h-16 grow"
          maxX={cycle.beats}
          maxY={1.1}
          minX={0}
          minY={0}
        >
          <PlotGrid x={{ format: formatBeats, ticks }} />
          <PlotGraph>
            <PlotArea fillTo={0} fn={cycle.level} />
            <PlotCurve fn={cycle.level} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={stutterDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { StutterPanel };
