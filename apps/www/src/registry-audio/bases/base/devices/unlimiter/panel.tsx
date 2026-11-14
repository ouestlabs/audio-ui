import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotLine,
  PlotTrace,
  PlotTraceArea,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type UnlimiterState,
  unlimiterDevice,
  unlimiterLift,
  unlimiterUnused,
} from "@/registry-audio/bases/base/devices/unlimiter/device";
import type { DeviceSignal } from "@/registry-audio/bases/base/lib/device-signal";

const MAX_SIZE_DB = 30;
const MAX_LIFT_DB = 18;
const SIZE_TICKS = [10, 20];
const LIFT_TICKS = [6, 12];
const SWITCHES = ["enabled"] as const;
const OFF = unlimiterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatDb = (db: number) => `${db} dB`;

/** The level at the foot of the plot for the envelope behind it, in dB: full scale at the top. */
const ENVELOPE_FLOOR_DB = -60;
/** The envelope's window: long enough for a few hits, short enough to see each attack. */
const ENVELOPE = { of: "level", points: 240, seconds: 1.5 } as const;

interface UnlimiterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: UnlimiterState) => void;
  /** Its live sound: the level going in and the level coming out over the last moments, the attacks it lifts. */
  signal?: DeviceSignal;
  value: UnlimiterState;
}

/**
 * The face of the unlimiter device: the lift it gives an attack for its size,
 * how far a fast follower of the level rises over a slow one, with the crest
 * an attack is lifted to when it is adaptive, over the knobs and switches,
 * those it does not use drawn off. Controlled like `DevicePanel`, which it
 * uses for them. Its children sit at the end of the title bar.
 */
function UnlimiterPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: UnlimiterPanelProps) {
  // What went in, filled, and what came out, a line over it, over the last moments: the attacks and the tails as it shapes them.
  const envelope = useMemo(() => {
    const heard = signal?.input?.history(ENVELOPE);
    const played = signal?.output.history(ENVELOPE);
    return heard && played ? { heard, played } : null;
  }, [signal]);
  const lift = useMemo(() => unlimiterLift(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={unlimiterDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="unlimiter-panel"
      >
        <Plot
          aria-label="Lift for the size of an attack"
          className="h-28 min-h-16 grow"
          maxX={MAX_SIZE_DB}
          maxY={MAX_LIFT_DB}
          minX={0}
          minY={0}
        >
          <PlotGrid
            x={{ format: formatDb, ticks: SIZE_TICKS }}
            y={{ format: formatDb, ticks: LIFT_TICKS }}
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
            {value.adaptive ? (
              <PlotLine
                axis="x"
                className="stroke-foreground/40"
                value={value.crestDb}
              />
            ) : null}
            <PlotCurve fn={lift} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={unlimiterDevice}
          disabled={value.enabled ? unlimiterUnused(value) : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { UnlimiterPanel };
