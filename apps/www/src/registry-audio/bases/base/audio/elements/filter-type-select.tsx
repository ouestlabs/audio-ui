"use client";

import { useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";

/** The response of each filter type, as the curve a plot draws: gain up the page, frequency across. */
const FILTER_PATHS: Record<string, string> = {
  bandpass: "M2 19c5 0 5-13 10-13s5 13 10 13",
  highcut: "M2 7h9c6 0 8 3 11 12",
  highpass: "M2 19c3-9 5-12 11-12h9",
  highshelf: "M2 17h8c3 0 4-9 7-9h5",
  // A cut is the same curve as the pass of the opposite side: what the band keeps.
  lowcut: "M2 19c3-9 5-12 11-12h9",
  lowpass: "M2 7h9c6 0 8 3 11 12",
  lowshelf: "M2 8h7c3 0 4 9 7 9h6",
  notch: "M2 7c5 0 5 12 10 12s5-12 10-12",
  peak: "M2 17h6c3 0 3-10 4-10s1 10 4 10h6",
};

/** Whether a value is one of the filter types this element draws. */
export const isFilterType = (value: string) => value in FILTER_PATHS;

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
        const path = FILTER_PATHS[option.value];
        return (
          <ToggleGroupItem
            aria-label={option.label}
            className="flex-1"
            key={option.value}
            title={option.label}
            value={option.value}
          >
            {path ? (
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d={path} />
              </svg>
            ) : (
              option.label
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export { FilterTypeSelect };
