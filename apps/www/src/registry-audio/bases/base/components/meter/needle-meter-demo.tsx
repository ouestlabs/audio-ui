"use client";

import { useMemo } from "react";
import { NeedleMeter } from "@/registry-audio/bases/base/audio/elements/needle-meter";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import { usePageMicrophone } from "@/registry-audio/bases/base/hooks/use-microphone";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";

/** The needle follows the microphone when the bar's microphone is on, and a moving signal when it is not. */
export default function NeedleMeterDemo() {
  const microphone = usePageMicrophone();
  const heard = useAudioLevels(
    useMemo(() => (microphone ? [microphone] : []), [microphone])
  );
  // 0 VU is -18 dB: the levels stay between -15 and +3 VU, where the dial is.
  const simulated = useSimulatedLevels(1, { max: -15, min: -33 });
  return (
    <NeedleMeter
      aria-label="Output level"
      source={microphone ? heard : simulated}
    />
  );
}
