"use client";

import { NeedleMeter } from "@/registry-audio/bases/base/audio/elements/needle-meter";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";

export default function NeedleMeterDemo() {
  // 0 VU is -18 dB: the levels stay between -15 and +3 VU, where the dial is.
  const source = useSimulatedLevels(1, { max: -15, min: -33 });
  return <NeedleMeter aria-label="Output level" source={source} />;
}
