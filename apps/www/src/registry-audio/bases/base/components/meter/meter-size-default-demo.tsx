"use client";

import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";

// The marks of a dBFS scale, down to the floor.
const SCALE = [6, 0, -6, -12, -20, -30, -40, -60];

export default function MeterSizeDefaultDemo() {
  const source = useSimulatedLevels(2);
  return (
    <Meter
      aria-label="Stereo output"
      marks={SCALE}
      source={source}
      warnThreshold={-12}
    />
  );
}
