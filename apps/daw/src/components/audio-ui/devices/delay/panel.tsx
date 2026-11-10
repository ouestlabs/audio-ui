"use client";

import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/core/time";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plot,
  PlotCursor,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/components/audio-ui/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type DelayState,
  delayDevice,
  delaySeconds,
  delayTaps,
  GRAIN_PARAMETERS,
  nearestDivision,
} from "@/components/audio-ui/devices/delay/device";

/** How much time the plot shows, from the dry sound on: the longest echo time is 2 s. */
const WINDOW_MS = 3000;
const TIME_TICKS = [500, 1000, 2000];
const PERCENT_TICKS = [25, 50, 75];
/** In the title bar: the switch and the mode. The grain delay's own knobs show with it alone. */
const IN_THE_TITLE_BAR = ["enabled", "mode"] as const;
const NOT_GRAIN = [...IN_THE_TITLE_BAR, ...GRAIN_PARAMETERS] as const;
const MODES =
  delayDevice.parameters.find((parameter) => parameter.id === "mode")
    ?.options ?? [];
const SYNCED_OFF = ["timeMs"] as const;
const FREE_OFF = ["division"] as const;

const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
const describePointer = (point: { x: number; y: number }) =>
  `${formatMs(point.x)} · ${Math.round(point.y)} %`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatMs(value) : `${Math.round(value)} %`;
const formatPercentMark = (percent: number) => `${percent}%`;

interface DelayPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DelayState) => void;
  /** The host's tempo, which a synced delay reads its note value against. @default 120 BPM */
  tempo?: Tempo;
  value: DelayState;
}

/**
 * The face of the delay device: the echoes it makes, one line each, fainter as
 * they fade, with a handle on the first: drag it across for the time and up for
 * the feedback. Synced to a tempo, the handle lands on the nearest note value
 * and the time knob is drawn off, as the note one is when it is not. The knobs
 * under it are the same parameters, for a precise value, and the grain
 * delay's pitch, spray, jitter and grain size when it is the mode, picked in
 * the title bar. Controlled like `DevicePanel`, which it uses for the knobs.
 * Its children sit at the end of the title bar.
 */
function DelayPanel({
  children,
  className,
  onValueChange,
  tempo = DEFAULT_TEMPO,
  value,
}: DelayPanelProps) {
  const taps = useMemo(
    () => delayTaps(value, WINDOW_MS, tempo),
    [tempo, value]
  );
  const seconds = delaySeconds(value, tempo);
  let unused: readonly string[] = ALL_BUT_SWITCH;
  if (value.enabled) {
    unused = value.sync ? SYNCED_OFF : FREE_OFF;
  }
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        delayDevice.apply(
          value,
          value.sync
            ? { division: nearestDivision(x / 1000, tempo), feedback: y }
            : { feedback: y, timeMs: x }
        ).state
      ),
    [onValueChange, tempo, value]
  );
  const pickMode = useCallback(
    (mode: string | null) => {
      if (mode) {
        onValueChange(delayDevice.set(value, "mode", mode));
      }
    },
    [onValueChange, value]
  );
  const grain = value.mode === "grain";
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={delayDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select
          disabled={!value.enabled}
          items={MODES}
          onValueChange={pickMode}
          value={value.mode}
        >
          <SelectTrigger
            aria-label="Mode"
            className="w-28 data-[size=sm]:h-6"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="delay-panel"
      >
        <Plot
          aria-label="Echoes"
          className="h-28 min-h-16 grow"
          maxX={WINDOW_MS}
          maxY={100}
          minX={0}
          minY={0}
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ format: formatMs, ticks: TIME_TICKS }}
            y={{ format: formatPercentMark, ticks: PERCENT_TICKS }}
          />
          <PlotGraph>
            {taps.map((tap) => (
              <PlotLine
                axis="x"
                className="stroke-primary"
                key={tap.timeMs}
                style={{ opacity: Math.max(0.15, Math.sqrt(tap.level)) }}
                value={tap.timeMs}
              />
            ))}
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Time and feedback"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: seconds * 1000, y: value.feedback }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-5"
          device={delayDevice}
          disabled={unused as never}
          exclude={grain ? IN_THE_TITLE_BAR : NOT_GRAIN}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

const ALL_BUT_SWITCH = delayDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

export { DelayPanel };