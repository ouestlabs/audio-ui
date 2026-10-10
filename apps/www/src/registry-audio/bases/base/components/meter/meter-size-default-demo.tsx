"use client";

import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";

const SCALE = [-48, -24, -12, -6, 0];

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
