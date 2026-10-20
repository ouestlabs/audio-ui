import { Meter } from "@audio-ui/react/meter";
import { useMemo } from "react";
import { useAudioLevels } from "@/hooks/use-audio-levels";

const decibels = (formatted: string) => `${formatted} dB`;

/** A level meter of one or two channels, lit in segments, its levels and peaks read off the analysers. */
export function Levels({
  analysers,
  label,
}: {
  analysers: readonly AnalyserNode[];
  label: string;
}) {
  const nodes = useMemo(() => [...analysers], [analysers]);
  const source = useAudioLevels(nodes);
  return (
    <Meter.Root
      aria-label={label}
      className="rigel-meter"
      orientation="vertical"
      scale="iec"
      source={source}
    >
      <Meter.Channels>
        {(index, count) => (
          <Meter.Channel
            aria-label={count > 1 ? `${label} ${index + 1}` : label}
            className="rigel-meter-channel"
            getAriaValueText={decibels}
            index={index}
            key={`channel-${index}`}
          >
            <Meter.Indicator className="rigel-meter-indicator" />
            <Meter.Peak className="rigel-meter-peak" />
          </Meter.Channel>
        )}
      </Meter.Channels>
    </Meter.Root>
  );
}
