"use client";

import { useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";

const WAVE_PATHS: Record<string, string> = {
  sawtooth: "M2 18l8-12v12l8-12v12",
  sine: "M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0",
  square: "M2 18h4V6h6v12h4V6h6",
  triangle: "M2 12l5-6 5 12 5-12 5 6",
};

interface WaveformOption {
  label: string;
  /** `sine`, `triangle`, `sawtooth` or `square` draw their shape; any other value shows its label. */
  value: string;
}

interface WaveformSelectProps {
  "aria-label"?: string;
  className?: string;
  onValueChange: (value: string) => void;
  /** What can be picked, such as the options of a device's `choice` parameter. */
  options: readonly WaveformOption[];
  value: string;
}

/** A row of buttons, one per waveform, each drawn as its shape: pick one. */
function WaveformSelect({
  className,
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
      onValueChange={pick}
      size="sm"
      value={[value]}
      variant="outline"
    >
      {options.map((option) => {
        const path = WAVE_PATHS[option.value];
        return (
          <ToggleGroupItem
            aria-label={`${option.label} wave`}
            className="flex-1"
            key={option.value}
            value={option.value}
          >
            {path ? (
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
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

export { WaveformSelect };
