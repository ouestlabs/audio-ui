import { useEffect, useMemo } from "react";
import {
  createSimulatedLevels,
  type SimulatedFrame,
} from "@/registry/bases/shared/lib/simulated-levels";

export type { SimulatedFrame };

/**
 * Levels that move on their own, in the shape a `Meter` paints from: a
 * random walk per channel with a peak that holds for a moment and then
 * falls, like a real signal's. A stand-in for the levels of an `AnalyserNode`
 * (see `useAudioLevels`), so a demo meter is never at rest. A stable source,
 * so each frame costs no React render. `min` and `max` keep the levels
 * between two values, in dB, for a meter with a narrower scale.
 */
export function useSimulatedLevels(
  channels = 2,
  { max, min }: { max?: number; min?: number } = {}
) {
  const simulated = useMemo(
    () => createSimulatedLevels(channels, { max, min }),
    [channels, max, min]
  );
  useEffect(() => simulated.run(), [simulated]);
  return simulated.source;
}
