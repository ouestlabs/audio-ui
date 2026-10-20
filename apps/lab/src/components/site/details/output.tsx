import { useEffect, useMemo } from "react";
import { Meter } from "@/components/audio-ui/meter";
import { SpectrumAnalyzer } from "@/components/audio-ui/spectrum-analyzer";
import { useAudioLevels } from "@/hooks/use-audio-levels";
import { useSpectrum } from "@/hooks/use-spectrum";

const LEVEL_MARKS = [-48, -24, -12, -6, 0] as const;

/**
 * The device's sound, seen: its level with a peak that holds, and its
 * spectrum. An analyser listens to the output and is never connected to the
 * speakers, so looking at the sound does not change it.
 */
export function Output({ output }: { output: AudioNode }) {
  const analyser = useMemo(() => {
    const node = output.context.createAnalyser();
    node.fftSize = 2048;
    node.smoothingTimeConstant = 0.8;
    return node;
  }, [output]);
  const analysers = useMemo(() => [analyser], [analyser]);

  useEffect(() => {
    output.connect(analyser);
    return () => {
      try {
        output.disconnect(analyser);
      } catch {
        // The device took its output down first: nothing is left to disconnect.
      }
    };
  }, [output, analyser]);

  const levels = useAudioLevels(analysers);
  const spectrum = useSpectrum(analyser);

  return (
    <div className="flex flex-col gap-4">
      <Meter
        aria-label="Output level"
        marks={LEVEL_MARKS}
        orientation="horizontal"
        size="sm"
        source={levels}
      />
      <SpectrumAnalyzer
        aria-label="Output spectrum"
        className="h-28"
        source={spectrum}
      />
    </div>
  );
}
