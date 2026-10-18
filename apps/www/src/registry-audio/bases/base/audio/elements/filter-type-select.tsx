"use client";

import {
  BandpassIcon,
  HighpassIcon,
  HighshelfIcon,
  type IconProps,
  LowpassIcon,
  LowshelfIcon,
  NotchIcon,
  PeakIcon,
} from "@audio-ui/icons/react";
import { type ComponentType, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";

/** The response of each filter type, as the curve a plot draws: gain up the page, frequency across. */
const FILTER_ICONS: Record<string, ComponentType<IconProps>> = {
  bandpass: BandpassIcon,
  // A cut is the same curve as the pass of the opposite side: what the band keeps.
  highcut: LowpassIcon,
  highpass: HighpassIcon,
  highshelf: HighshelfIcon,
  lowcut: HighpassIcon,
  lowpass: LowpassIcon,
  lowshelf: LowshelfIcon,
  notch: NotchIcon,
  peak: PeakIcon,
};

/** Whether a value is one of the filter types this element draws. */
export const isFilterType = (value: string) => value in FILTER_ICONS;

interface FilterTypeOption {
  label: string;
  /** A filter type this element draws: `lowpass`, `highpass`, `bandpass`, `notch`, `lowcut`, `highcut`, `lowshelf`, `highshelf` or `peak`; any other shows its label. */
  value: string;
}

interface FilterTypeSelectProps {
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  /** What can be picked, such as the options of a device's `choice` parameter. */
  options: readonly FilterTypeOption[];
  value: string;
}

/** A row of buttons, one per filter type, each drawn as the response it has: pick one. */
function FilterTypeSelect({
  className,
  disabled,
  onValueChange,
  options,
  value,
  ...props
}: FilterTypeSelectProps) {
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
      data-slot="filter-type-select"
      disabled={disabled}
      onValueChange={pick}
      size="sm"
      value={[value]}
      variant="outline"
    >
      {options.map((option) => {
        const Icon = FILTER_ICONS[option.value];
        return (
          <ToggleGroupItem
            aria-label={option.label}
            className="flex-1"
            key={option.value}
            title={option.label}
            value={option.value}
          >
            {Icon ? <Icon className="size-5" weight="bold" /> : option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export { FilterTypeSelect };
