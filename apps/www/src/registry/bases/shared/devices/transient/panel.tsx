import { type ReactNode, useCallback, useMemo } from "react";
import { formatLevel } from "@/engine/format";
import {
  Plot,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
  PlotTrace,
  PlotTraceArea,
} from "@/registry/bases/shared/audio-ui/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio-ui/panels/device-panel";
import {
  type TransientState,
  transientDevice,
} from "@/registry/bases/shared/devices/transient/device";
import type { DeviceSignal } from "@/registry/lib/device-signal";
import { cn } from "@/registry/lib/utils";

const LIMIT_DB = 12;
const TICKS = [-12, 0, 12];
const IN_THE_TITLE_BAR = ["enabled"] as const;
const OFF = transientDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describeValue = (value: number) => formatLevel(value);
const getAriaLabel = (axis: "x" | "y") => (axis === "x" ? "Sustain" : "Attack");

/** The level at the foot of the plot for the envelope behind it, in dB: full scale at the top. */
const ENVELOPE_FLOOR_DB = -60;
/** The envelope's window: long enough for a few hits, short enough to see each attack. */
const ENVELOPE = { of: "level", points: 240, seconds: 1.5 } as const;

interface TransientPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: TransientState) => void;
  /** Its live sound: the level going in and the level coming out over the last moments, its attacks and its sustain as it shapes them. */
  signal?: DeviceSignal;
  value: TransientState;
}

/**
 * The face of the transient shaper device: a square with the sustain across and the attack up, and a handle to drag
 * to both at once. The centre is a
 * sound left as it is. The output is the knob under it. Controlled like
 * `DevicePanel`, which it uses for the knobs. Its children sit at the end of
 * the title bar.
 */
function TransientPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: TransientPanelProps) {
  // What went in, filled, and what came out, a line over it, over the last moments: the attacks and the tails as it shapes them.
  const envelope = useMemo(() => {
    const heard = signal?.input?.history(ENVELOPE);
    const played = signal?.output.history(ENVELOPE);
    return heard && played ? { heard, played } : null;
  }, [signal]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        transientDevice.apply(value, { attackDb: y, sustainDb: x }).state
      ),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={transientDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="transient-panel"
      >
        <Plot
          aria-label="Attack and sustain"
          className="h-28 min-h-16 grow"
          maxX={LIMIT_DB}
          maxY={LIMIT_DB}
          minX={-LIMIT_DB}
          minY={-LIMIT_DB}
        >
          <PlotGrid
            x={{ format: formatMark, ticks: TICKS }}
            y={{ format: formatMark, ticks: TICKS }}
          />
          <PlotGraph>
            {envelope ? (
              <>
                {/* Behind the control, on a level scale of its own: what went in, filled, and what came out, a line over it, over the last moments. */}
                <PlotTraceArea
                  fillTo={ENVELOPE_FLOOR_DB}
                  max={0}
                  min={ENVELOPE_FLOOR_DB}
                  source={envelope.heard}
                />
                <PlotTrace
                  className="stroke-primary/60 group-data-idle/device:hidden"
                  max={0}
                  min={ENVELOPE_FLOOR_DB}
                  source={envelope.played}
                />
              </>
            ) : null}
            <PlotLine axis="x" className="stroke-foreground/40" value={0} />
            <PlotLine axis="y" className="stroke-foreground/40" value={0} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Attack and sustain"
              getAriaLabel={getAriaLabel}
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.sustainDb, y: value.attackDb }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          device={transientDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { TransientPanel };
