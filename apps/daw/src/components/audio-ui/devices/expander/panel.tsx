import { type ReactNode, useCallback, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type ExpanderState,
  expanderCurve,
  expanderDevice,
} from "@/components/audio-ui/devices/expander/device";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
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

const MIN_DB = -80;
const MAX_IN_DB = 0;
/** Upward, the output goes over what came in: room above 0 dB for it. */
const MAX_OUT_DB = 12;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
const IN_THE_TITLE_BAR = ["enabled", "mode"] as const;
const MODES =
  expanderDevice.parameters.find((parameter) => parameter.id === "mode")
    ?.options ?? [];
const OFF = expanderDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled" && id !== "mode");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface ExpanderPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: ExpanderState) => void;
  value: ExpanderState;
}

/**
 * The face of the expander device: the mode picked in its title bar, its
 * transfer curve against the straight line of a clean sound, with a handle on
 * the threshold to drag across, over the knobs. Controlled like
 * `DevicePanel`, which it uses for the knobs. Its children sit at the end of
 * the title bar.
 */
function ExpanderPanel({
  children,
  className,
  onValueChange,
  value,
}: ExpanderPanelProps) {
  const curve = useMemo(() => expanderCurve(value), [value]);
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(expanderDevice.apply(value, { thresholdDb: x }).state),
    [onValueChange, value]
  );
  const pickMode = useCallback(
    (mode: string | null) => {
      if (mode) {
        onValueChange(expanderDevice.set(value, "mode", mode));
      }
    },
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={expanderDevice}
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
        data-slot="expander-panel"
      >
        <Plot
          aria-label="Transfer curve"
          className="h-28 min-h-16 grow"
          maxX={MAX_IN_DB}
          maxY={MAX_OUT_DB}
          minX={MIN_DB}
          minY={MIN_DB}
        >
          <PlotGrid
            x={{ ticks: DB_TICKS }}
            y={{ ticks: DB_TICKS.slice(0, 2) }}
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
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Threshold"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.thresholdDb, y: curve(value.thresholdDb) }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={expanderDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { ExpanderPanel };
