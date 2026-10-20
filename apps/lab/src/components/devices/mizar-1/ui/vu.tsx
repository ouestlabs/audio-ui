import { useMemo } from "react";
import { NeedleMeter } from "@/components/audio-ui/needle-meter";
import { useAudioLevels } from "@/hooks/use-audio-levels";

/** The output VU: the dial of the registry, its needle turned straight in the DOM. */
export function Vu({ analyser }: { analyser: AnalyserNode }) {
  const nodes = useMemo(() => [analyser], [analyser]);
  const source = useAudioLevels(nodes);
  return (
    <NeedleMeter
      aria-label="Output level"
      className="mizar-vu"
      source={source}
    />
  );
}
