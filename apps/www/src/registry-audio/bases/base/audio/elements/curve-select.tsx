"use client";

import { CurveIcon } from "@audio-ui/icons/react";
import { useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";

interface CurveOption {
  label: string;
  value: string;
}

interface CurveSelectProps {
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: readonly CurveOption[];
  /**
   * The output for an input from -1 to 1, for the option `value`: the same
   * function the device plays, so each button draws what it does.
   */
  shape: (value: string, input: number) => number;
  value: string;
}

/** A row of buttons, one per transfer curve, each drawn from the curve itself: pick one. */
function CurveSelect({
  className,
  disabled,
  onValueChange,
  options,
  shape,
  value,
  ...props
}: CurveSelectProps) {
  const pick = useCallback(
    (values: unknown[]) => {
      const [next] = values;
      if (typeof next === "string") {
        onValueChange(next);
      }
    },
    [onValueChange]
  );
  const curves = useMemo(
    () =>
      options.map((option) => ({
        option,
        shape: (input: number) => shape(option.value, input),
      })),
    [options, shape]
  );
  return (
    <ToggleGroup
      aria-label={props["aria-label"]}
      className={cn("w-full", className)}
      data-slot="curve-select"
      disabled={disabled}
      onValueChange={pick}
      size="sm"
      value={[value]}
      variant="outline"
    >
      {curves.map(({ option, shape: curve }) => (
        <ToggleGroupItem
          aria-label={option.label}
          className="flex-1"
          key={option.value}
          title={option.label}
          value={option.value}
        >
          <CurveIcon className="size-5" shape={curve} weight="bold" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export { CurveSelect };
