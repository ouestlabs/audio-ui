import { useMemo } from "react";
import { NeedleMeter } from "@/components/audio-ui/needle-meter";
import { useAudioLevels } from "@/hooks/use-audio-levels";

/** A VU meter that reads one analyser: the dial of the registry, its needle turned straight in the DOM. */
export function Vu({
  analyser,
  label,
}: {
  analyser: AnalyserNode;
  label: string;
}) {
  const nodes = useMemo(() => [analyser], [analyser]);
  const source = useAudioLevels(nodes);
  return (
    <NeedleMeter aria-label={label} className="deneb-vu" source={source} />
  );
}
