"use client";

import { NeedleMeter } from "@/registry-audio/bases/base/audio/elements/needle-meter";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";

export default function NeedleMeterDemo() {
  const source = useSimulatedLevels(1);
  return <NeedleMeter aria-label="Output level" source={source} />;
}
