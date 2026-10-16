"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";

const SIZE = 24;
const MARGIN = 3;
const SAMPLES = 25;

/** The polyline of `shape` over inputs from -1 to 1, in a square of `SIZE`, output up the page. */
function pathOf(shape: (input: number) => number) {
  const span = SIZE - 2 * MARGIN;
  return Array.from({ length: SAMPLES }, (_, index) => {
    const input = (index / (SAMPLES - 1)) * 2 - 1;
    const output = Math.max(-1, Math.min(1, shape(input)));
    const x = MARGIN + ((input + 1) / 2) * span;
    const y = MARGIN + ((1 - output) / 2) * span;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join("");
}

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
  const paths = useMemo(
    () =>
      Object.fromEntries(
        options.map((option) => [
          option.value,
          pathOf((input) => shape(option.value, input)),
        ])
      ),
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
      {options.map((option) => (
        <ToggleGroupItem
          aria-label={option.label}
          className="flex-1"
          key={option.value}
          title={option.label}
          value={option.value}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            <path d={paths[option.value]} />
          </svg>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export { CurveSelect };
