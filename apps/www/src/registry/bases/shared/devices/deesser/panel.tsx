import { type ReactNode, useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFrequency, formatLevel } from "@/engine/format";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotTraceArea,
} from "@/registry/bases/shared/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry/bases/shared/audio/panels/device-panel";
import {
  type DeesserState,
  deesserDevice,
  deesserResponse,
  deesserUnused,
} from "@/registry/bases/shared/devices/deesser/device";
import type { DeviceSignal } from "@/registry/bases/shared/lib/device-signal";
import { cn } from "@/registry/bases/shared/lib/utils";

const MIN_HZ = 500;
const MAX_HZ = 20_000;
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const MIN_DB = -30;
const MAX_DB = 6;
const MAX_RANGE_DB = 24;
const DB_TICKS = [-24, -12, 0];
const IN_THE_TITLE_BAR = ["enabled", "model"] as const;
const MODELS =
  deesserDevice.parameters.find((parameter) => parameter.id === "model")
    ?.options ?? [];
const OFF = deesserDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled" && id !== "model");

const formatDbMark = (db: number) =>
  formatLevel(db, "dB", { decimals: 0, unit: false });
const describePointer = (point: { x: number; y: number }) =>
  `${formatFrequency(point.x)} · ${formatLevel(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatFrequency(value) : formatLevel(value);
const getAriaLabel = (axis: "x" | "y") =>
  axis === "x" ? "Frequency" : "Reduction at the frequency";

/**
 * The range that puts the curve at `db` at the frequency. A split has each
 * half 6 dB down there, so the highs' gain is 2 * 10^(db / 20) - 1; a band
 * and the whole sound are cut in full there, so the range is the depth.
 */
const rangeFor = (model: DeesserState["model"], db: number) => {
  if (model === "band" || model === "broadband") {
    return Math.min(MAX_RANGE_DB, -db);
  }
  const gain = Math.max(0, 2 * 10 ** (db / 20) - 1);
  return gain > 0 ? -20 * Math.log10(gain) : MAX_RANGE_DB;
};

interface DeesserPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: DeesserState) => void;
  /** Its live sound: the spectrum of what comes out, behind the reduction it makes at each frequency. */
  signal?: DeviceSignal;
  value: DeesserState;
}

/**
 * The face of the de-esser device: the model picked in its title bar, what it
 * does at each frequency when the highs are taken down as far as the range
 * allows, with a handle on the curve at the frequency to drag across, and
 * down for the range. The over body, the ratio and the range are the
 * knobs under it, those the model does not use drawn off. Controlled like
 * `DevicePanel`, which it uses for them. Its children sit at the end of the
 * title bar.
 */
function DeesserPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: DeesserPanelProps) {
  const spectrum = useMemo(
    () => signal?.output.spectrum({ maxHz: MAX_HZ, minHz: MIN_HZ }),
    [signal]
  );
  const response = useMemo(() => deesserResponse(value), [value]);
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      onValueChange(
        deesserDevice.apply(value, {
          frequencyHz: x,
          rangeDb: rangeFor(value.model, y),
        }).state
      ),
    [onValueChange, value]
  );
  const pickModel = useCallback(
    (model: string | null) => {
      if (model) {
        onValueChange(deesserDevice.set(value, "model", model));
      }
    },
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={deesserDevice}
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
            className="w-28 data-[size=sm]:h-6"
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
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="deesser-panel"
      >
        <Plot
          aria-label="Reduction at each frequency"
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
          className="grid-cols-4"
          device={deesserDevice}
          disabled={value.enabled ? deesserUnused(value.model) : OFF}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { DeesserPanel };
