"use client";

import { formatDb, formatHz } from "@audio-ui/core/analysis";
import type { Source } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotTraceArea,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type ChannelEqState,
  channelEqCurve,
  channelEqDevice,
} from "@/registry-audio/bases/base/lib/channel-eq-device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MAX_DB = 18;
const DB_TICKS = [-12, 0, 12];
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const SWITCHES = ["enabled"] as const;
const OFF = channelEqDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const getAriaLabel = (axis: "x" | "y") =>
  axis === "x" ? "Mid frequency" : "Mid gain";
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);

interface ChannelEqPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: ChannelEqState) => void;
  /** A live spectrum behind the curve, such as from `useSpectrum`. */
  spectrum?: Source<Float32Array>;
  value: ChannelEqState;
}

/**
 * The face of the channel EQ device: the curve it plays, with a handle on the
 * mid band: drag it across for its frequency and up for its gain. The shelves
 * and the high-pass are knobs and a switch under the curve, as on a mixer
 * strip. Controlled like `DevicePanel`, which it uses for them. Its children
 * sit at the end of the title bar.
 */
function ChannelEqPanel({
  children,
  className,
  onValueChange,
  spectrum,
  value,
}: ChannelEqPanelProps) {
  const curve = useMemo(() => channelEqCurve(value), [value]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        channelEqDevice.apply(value, {
          midDb: y - value.outputDb,
          midHz: x,
        }).state
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={channelEqDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="channel-eq-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="h-28 min-h-24 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={-MAX_DB}
          scaleX="log"
        >
          <PlotCursor format={describePointer} />
          <PlotGrid
            x={{ count: 6 }}
            y={{ format: formatDbMark, ticks: DB_TICKS }}
          />
          <PlotGraph>
            {spectrum ? (
              <PlotTraceArea
                fillTo={SPECTRUM_MIN_DB}
                max={SPECTRUM_MAX_DB}
                min={SPECTRUM_MIN_DB}
                source={spectrum}
              />
            ) : null}
            <PlotArea fillTo={0} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Mid band"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.midHz, y: curve(value.midHz) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={channelEqDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ChannelEqPanel };
