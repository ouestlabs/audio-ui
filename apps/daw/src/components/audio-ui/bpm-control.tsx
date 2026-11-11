"use client";

import { ParameterField } from "@/components/audio-ui/parameter-field";
import { cn } from "@/lib/utils";

const DEFAULT_MIN_BPM = 20;
const DEFAULT_MAX_BPM = 200;

interface BpmControlProps {
  className?: string;
  max?: number;
  min?: number;
  onValueChange: (bpm: number) => void;
  value: number;
}

/**
 * The tempo: whole beats per minute, from 20 to 200 unless told otherwise, as
 * a parameter field that joins a `ButtonGroup`: type it, step it with the
 * arrows, or drag its `BPM` unit to scrub it.
 */
export function BpmControl({
  className,
  max = DEFAULT_MAX_BPM,
  min = DEFAULT_MIN_BPM,
  ...props
}: BpmControlProps) {
  return (
    <ParameterField
      className={cn("w-24", className)}
      hideLabel
      label={`Tempo in beats per minute, ${min} to ${max}`}
      max={max}
      min={min}
      unit="BPM"
      {...props}
    />
  );
}
