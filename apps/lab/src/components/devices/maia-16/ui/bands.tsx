import { Meter } from "@audio-ui/react/meter";
import { useAudioLevels } from "@/hooks/use-audio-levels";
import { BAND_HERTZ } from "../audio/engine";

/** The bands printed under the ladders: every fifth, from the lowest to the highest. */
const PRINTED = new Set([0, 5, 10, 15]);
const kilohertz = (hz: number) =>
  hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz / 10) * 10}`;
const decibels = (formatted: string) => `${formatted} dB`;

/**
 * The analysis display: a ladder of lamps per band, low to high, lit by what
 * the voice puts in that band. One meter of sixteen channels, its levels read
 * off the bands' analysers and painted outside React.
 */
export function Bands({ analysers }: { analysers: readonly AnalyserNode[] }) {
  const source = useAudioLevels(analysers);
  return (
    <div className="maia-display">
      <Meter.Root
        aria-label="Voice bands"
        className="maia-bands"
        clipThreshold={-12}
        max={-10}
        min={-58}
        orientation="vertical"
        source={source}
      >
        <Meter.Channels>
          {(index) => (
            <Meter.Channel
              aria-label={`Band ${kilohertz(BAND_HERTZ[index] ?? 0)} Hz`}
              className="maia-band"
              getAriaValueText={decibels}
              index={index}
              key={`band-${BAND_HERTZ[index]}`}
            >
              <Meter.Indicator className="maia-band-level" />
            </Meter.Channel>
          )}
        </Meter.Channels>
      </Meter.Root>
      <div aria-hidden="true" className="maia-band-scale">
        {BAND_HERTZ.map((hz, index) => (
          <span key={hz}>{PRINTED.has(index) ? kilohertz(hz) : ""}</span>
        ))}
      </div>
    </div>
  );
}
