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
  type FrequencyShifterState,
  frequencyShifterDevice,
  frequencyShifterPartials,
} from "@/registry-audio/bases/base/devices/frequency-shifter/device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const IN_THE_TITLE_BAR = ["enabled", "mode"] as const;
const ALL = frequencyShifterDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled" && id !== "mode");
const MODES =
  frequencyShifterDevice.parameters.find((parameter) => parameter.id === "mode")
    ?.options ?? [];
/** The controls a mode does not use. */
const UNUSED = {
  ring: ["shiftHz", "precision"],
  shift: ["frequencyHz"],
} as const;

interface FrequencyShifterPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: FrequencyShifterState) => void;
  value: FrequencyShifterState;
}

/**
 * The face of the frequency shifter device: what it does to a note and its
 * harmonics, the frequencies that go in drawn faint and the ones that come
 * out, over its knobs, the mode picked in its title bar. Controlled like
 * `DevicePanel`, which it uses for them. Its children sit at the end of the
 * title bar.
 */
function FrequencyShifterPanel({
  children,
  className,
  onValueChange,
  value,
}: FrequencyShifterPanelProps) {
  const partials = useMemo(() => {
    const { input, output } = frequencyShifterPartials(value);
    // Off, or with nothing of it mixed in, what comes out is what goes in.
    const changed = value.enabled && value.mix > 0;
    return { input, output: changed ? output : input };
  }, [value]);
  const pickMode = useCallback(
    (mode: string | null) => {
      if (mode) {
        onValueChange(frequencyShifterDevice.set(value, "mode", mode));
      }
    },
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={frequencyShifterDevice}
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
            className="w-24 data-[size=sm]:h-6"
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
        data-slot="frequency-shifter-panel"
      >
        <Plot
          aria-label="A note and its harmonics, in and out"
          className="h-28 min-h-16 grow"
          maxX={MAX_HZ}
          maxY={1}
          minX={MIN_HZ}
          minY={0}
          scaleX="log"
        >
          <PlotGrid x={{ count: 6 }} />
          <PlotGraph>
            {partials.input.map((hz) => (
              <PlotLine
                axis="x"
                className="stroke-muted-foreground/50 [stroke-dasharray:3_3]"
                key={`in-${hz}`}
                value={hz}
              />
            ))}
            {partials.output.map((hz) => (
              <PlotLine
                axis="x"
                className="stroke-foreground"
                key={`out-${hz}`}
                value={hz}
              />
            ))}
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={frequencyShifterDevice}
          disabled={value.enabled ? UNUSED[value.mode] : ALL}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { FrequencyShifterPanel };
