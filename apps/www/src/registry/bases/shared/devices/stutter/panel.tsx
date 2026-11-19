import { type ReactNode, useMemo } from "react";
import { DEFAULT_TEMPO, secondsPerBeat } from "@/engine/time";
import {
  Plot,
  PlotArea,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotTraceArea,
} from "@/registry/bases/shared/audio-ui/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio-ui/panels/device-panel";
import {
  type StutterState,
  stutterCycle,
  stutterDevice,
} from "@/registry/bases/shared/devices/stutter/device";
import type { DeviceSignal } from "@/registry/lib/devices/device-signal";
import { cn } from "@/registry/lib/utils";

const SWITCHES = ["enabled"] as const;
const OFF = stutterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");
const formatBeats = (beats: number) => `${Number(beats.toFixed(2))}`;

/** The level at the foot of the plot for what plays, in dB: full scale at the top. */
const PLAYED_FLOOR_DB = -60;

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
  // What comes out over one interval as drawn, newest at the end: its slices and their repeats as they play.
  const played = useMemo(
    () =>
      signal?.output.history({
        of: "level",
        points: 240,
        seconds: cycle.beats * secondsPerBeat(DEFAULT_TEMPO),
      }),
    [cycle.beats, signal]
  );
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
            {played ? (
              <PlotTraceArea
                fillTo={PLAYED_FLOOR_DB}
                max={0}
                min={PLAYED_FLOOR_DB}
                source={played}
              />
            ) : null}
            <PlotArea
              // The slices as set are filled while no sound goes in; once it does, the fill is what plays, and the setting a line over it.
              className={
                played ? "hidden group-data-idle/device:inline" : undefined
              }
              fillTo={0}
              fn={cycle.level}
            />
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
