"use client";

import {
  type IconProps,
  SawtoothIcon,
  SineIcon,
  SquareIcon,
  TriangleIcon,
} from "@audio-ui/icons/react";
import { type ComponentType, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";

const WAVE_ICONS: Record<string, ComponentType<IconProps>> = {
  sawtooth: SawtoothIcon,
  sine: SineIcon,
  square: SquareIcon,
  triangle: TriangleIcon,
};

/** Whether a value is one of the four shapes this element draws. */
export const isWaveform = (value: string) => value in WAVE_ICONS;

interface WaveformOption {
  label: string;
  /** `sine`, `triangle`, `sawtooth` or `square` draw their shape; any other value shows its label. */
  value: string;
}

interface WaveformSelectProps {
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  /** What can be picked, such as the options of a device's `choice` parameter. */
  options: readonly WaveformOption[];
  value: string;
}

/** A row of buttons, one per waveform, each drawn as its shape: pick one. */
function WaveformSelect({
  className,
  disabled,
  onValueChange,
  options,
  value,
  ...props
}: WaveformSelectProps) {
  const pick = useCallback(
    (values: unknown[]) => {
      const [next] = values;
      if (typeof next === "string") {
        onValueChange(next);
      }
    },
    [onValueChange]
  );
  return (
    <ToggleGroup
      aria-label={props["aria-label"]}
      className={cn("w-full", className)}
      data-slot="waveform-select"
      disabled={disabled}
      onValueChange={pick}
      size="sm"
      value={[value]}
      variant="outline"
    >
      {options.map((option) => {
        const Icon = WAVE_ICONS[option.value];
        return (
          <ToggleGroupItem
            aria-label={`${option.label} wave`}
            className="flex-1"
            key={option.value}
            value={option.value}
          >
            {Icon ? <Icon className="size-5" weight="bold" /> : option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export { WaveformSelect };
