import { formatFrequency, formatLevel } from "@audio-ui/engine/format";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type WahState,
  wahCurve,
  wahDevice,
  wahReach,
} from "@/components/audio-ui/devices/wah/device";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/components/audio-ui/plot";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 30;
const DB_TICKS = [-24, -12, 0, 12, 24];
const IN_THE_TITLE_BAR = ["enabled", "mode"] as const;
const ALL = wahDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled" && id !== "mode");
const MODES =
  wahDevice.parameters.find((parameter) => parameter.id === "mode")?.options ??
  [];
/** The controls a mode does not use. */
const UNUSED = {
  envelope: ["rateHz", "sync", "division", "depth"],
  pedal: [
    "rangeHz",
    "sensitivity",
    "attackMs",
    "releaseMs",
    "rateHz",
    "sync",
    "division",
    "depth",
  ],
  sweep: ["rangeHz", "sensitivity", "attackMs", "releaseMs"],
} as const;
const SYNCED_OFF = ["rateHz"] as const;
const FREE_OFF = ["division"] as const;

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatFrequency(point.x)} · ${formatLevel(point.y)}`;

interface WahPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: WahState) => void;
  value: WahState;
}

/**
 * The face of the wah device: the band where it rests, and dashed where its
 * travel ends, over its knobs, the mode picked in its title bar; the knobs the
 * mode does not use are drawn off. Controlled like `DevicePanel`, which it
 * uses for them. Its children sit at the end of the title bar.
 */
function WahPanel({
  children,
  className,
  onValueChange,
  value,
}: WahPanelProps) {
  const curves = useMemo(() => {
    const reach = wahReach(value);
    return {
      ends:
        reach.low === reach.high
          ? []
          : [wahCurve(value, reach.low), wahCurve(value, reach.high)],
      rest: wahCurve(value, reach.rest),
    };
  }, [value]);
  const pickMode = useCallback(
    (mode: string | null) => {
      if (mode) {
        onValueChange(wahDevice.set(value, "mode", mode));
      }
    },
    [onValueChange, value]
  );
  let unused: readonly (typeof ALL)[number][] = ALL;
  if (value.enabled) {
    unused = UNUSED[value.mode];
    if (value.mode === "sweep") {
      unused = [...unused, ...(value.sync ? SYNCED_OFF : FREE_OFF)];
    }
  }
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={wahDevice}
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
        data-slot="wah-panel"
      >
        <Plot
          aria-label="The band and its travel"
          className="h-28 min-h-16 grow"
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
            {curves.ends.map((end, index) => (
              <PlotCurve
                className="stroke-muted-foreground [stroke-dasharray:4_4]"
                fn={end}
                key={index === 0 ? "low" : "high"}
              />
            ))}
            <PlotArea fillTo={MIN_DB} fn={curves.rest} />
            <PlotCurve fn={curves.rest} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-6"
          device={wahDevice}
          disabled={unused}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { WahPanel };
