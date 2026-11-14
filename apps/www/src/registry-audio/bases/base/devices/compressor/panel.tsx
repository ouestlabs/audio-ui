import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import {
  Plot,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type CompressorState,
  compressorCurve,
  compressorDevice,
  compressorUnused,
} from "@/registry-audio/bases/base/devices/compressor/device";
import {
  curveDot,
  type DeviceSignal,
} from "@/registry-audio/bases/base/lib/device-signal";

const MIN_DB = -60;
const MAX_DB = 6;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
/** What the knobs gather: the curve, the timing, the output. */
const GROUPS = [
  { label: "Curve", parameters: ["thresholdDb", "ratio", "kneeDb"] },
  { label: "Time", parameters: ["attackMs", "releaseMs"] },
  {
    label: "Output",
    parameters: ["makeupDb", "mix"],
  },
] as const;
const IN_THE_TITLE_BAR = ["enabled", "model"] as const;
const MODELS =
  compressorDevice.parameters.find((parameter) => parameter.id === "model")
    ?.options ?? [];

interface CompressorPanelProps {
  /** Whatever the host puts next to the name: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: CompressorState) => void;
  /** Its live sound: a dot rides the curve at the level going in, and its levels and the gain it takes off stand at the edge. */
  signal?: DeviceSignal;
  value: CompressorState;
}

/**
 * The face of the compressor device: a title bar with the on square and the
 * model, the transfer curve it plays with the threshold and the level going
 * in on it, and its knobs and switches gathered by what they do, those a
 * model does not use drawn off. It is controlled like `DevicePanel`, which it
 * uses for the knobs. Its children sit at the end of the title bar.
 */
function CompressorPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: CompressorPanelProps) {
  const output = useMemo(() => compressorCurve(value), [value]);
  const pickModel = useCallback(
    (model: string | null) => {
      if (model) {
        onValueChange(compressorDevice.set(value, "model", model));
      }
    },
    [onValueChange, value]
  );
  const unused = compressorUnused(value.model);
  // The dot rides the curve at the level going in, the louder of its channels.
  const dot = useMemo(() => {
    const levels = signal?.input?.levels;
    return levels && curveDot(levels, output);
  }, [output, signal]);
  return (
    <div
      className={cn("h-full w-full", className)}
      data-slot="compressor-panel"
    >
      <DeviceFrame className="h-full" signal={signal}>
        <DeviceHeader
          activator="enabled"
          device={compressorDevice}
          onValueChange={onValueChange}
          value={value}
        >
          <Select
            disabled={!value.enabled}
            items={MODELS}
            onValueChange={pickModel}
            value={value.model}
          >
            <SelectTrigger
              aria-label="Model"
              className="w-24 data-[size=sm]:h-6"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {children}
        </DeviceHeader>
        <div className="flex min-h-0 grow flex-col gap-2 p-2">
          <Plot
            aria-label="Transfer curve"
            className="h-28 min-h-16 grow"
            maxX={MAX_DB}
            maxY={MAX_DB}
            minX={MIN_DB}
            minY={MIN_DB}
          >
            <PlotGrid
              x={{ ticks: DB_TICKS }}
              // Only -24 up the side: -48 would sit on the row of the figures along the bottom.
              y={{ ticks: DB_TICKS.slice(1, 2) }}
            />
            <PlotGraph>
              <PlotCurve
                className="stroke-border [stroke-dasharray:4_4]"
                fn={UNITY}
              />
              <PlotLine
                axis="x"
                className="stroke-foreground/40"
                value={value.thresholdDb}
              />
              <PlotCurve fn={output} />
            </PlotGraph>
            {dot ? (
              // With no sound going in, the dot has no place on the curve.
              <PlotDot className="group-data-idle/device:hidden" source={dot} />
            ) : null}
          </Plot>
          <DevicePanel
            device={compressorDevice}
            disabled={unused}
            exclude={IN_THE_TITLE_BAR}
            groups={GROUPS}
            onValueChange={onValueChange}
            value={value}
          />
        </div>
      </DeviceFrame>
    </div>
  );
}

export { CompressorPanel };
