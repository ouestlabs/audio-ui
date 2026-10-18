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
  type DeesserState,
  deesserDevice,
  deesserResponse,
} from "@/registry-audio/bases/base/lib/deesser-device";

const MIN_HZ = 500;
const MAX_HZ = 20_000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MIN_DB = -30;
const MAX_DB = 6;
const MAX_RANGE_DB = 24;
const DB_TICKS = [-24, -12, 0];
const SWITCHES = ["enabled"] as const;
const OFF = deesserDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);
const getAriaLabel = (axis: "x" | "y") =>
  axis === "x" ? "Frequency" : "Reduction at the frequency";

/** The range that puts the curve at `db` at the frequency, where each half of the split is 6 dB down: the highs' gain is then 2 * 10^(db / 20) - 1. */
const rangeFor = (db: number) => {
  const gain = Math.max(0, 2 * 10 ** (db / 20) - 1);
  return gain > 0 ? -20 * Math.log10(gain) : MAX_RANGE_DB;
};

interface DeesserPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DeesserState) => void;
  /** A live spectrum behind the curve, such as from `useSpectrum`. */
  spectrum?: Source<Float32Array>;
  value: DeesserState;
}

/**
 * The face of the de-esser device: what it does at each frequency when the
 * highs are taken down as far as the range allows, with a handle on the
 * curve at the frequency to drag across, and down for the range. The threshold, the ratio
 * and the listen switch are the knobs under it. Controlled like `DevicePanel`,
 * which it uses for them. Its children sit at the end of the title bar.
 */
function DeesserPanel({
  children,
  className,
  onValueChange,
  spectrum,
  value,
}: DeesserPanelProps) {
  const response = useMemo(() => deesserResponse(value), [value]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        deesserDevice.apply(value, { frequencyHz: x, rangeDb: rangeFor(y) })
          .state
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={deesserDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="deesser-panel"
      >
        <Plot
          aria-label="Reduction at each frequency"
          className="h-28 min-h-24 grow"
          maxX={MAX_HZ}
          maxY={MAX_DB}
          minX={MIN_HZ}
          minY={MIN_DB}
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
            <PlotArea fillTo={0} fn={response} />
            <PlotCurve fn={response} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Frequency and range"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.frequencyHz, y: response(value.frequencyHz) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-5"
          device={deesserDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { DeesserPanel };
