import { createSource, type Meter as MeterPrimitive } from "@audio-ui/react";
import { Meter } from "@audio-ui/react/meter";
import { useEffect, useState } from "react";
import { TAPE_SECONDS } from "../audio/engine";

const SECONDS = [0, 2, 4, 6, 8] as const;
const seconds = (formatted: string) => `${formatted} seconds`;

/**
 * How much tape is left on the key that has played longest: a gauge in
 * seconds, full when no key is down, empty when a held note has run out. It
 * reads the engine each frame and paints outside React.
 */
export function TapeGauge({ read }: { read: () => number }) {
  const [source] = useState(() =>
    createSource<MeterPrimitive.Root.Frame>({ levels: [TAPE_SECONDS] })
  );
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const left = Math.round(read() * 20) / 20;
      if (source.getSnapshot().levels[0] !== left) {
        source.set({ levels: [left] });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [read, source]);

  return (
    <div className="rhea-gauge">
      <Meter.Root
        aria-label="Tape left"
        className="rhea-gauge-meter"
        clipThreshold={TAPE_SECONDS + 1}
        max={TAPE_SECONDS}
        min={0}
        orientation="horizontal"
        source={source}
      >
        <Meter.Channels>
          {(index) => (
            <Meter.Channel
              aria-label="Tape left"
              className="rhea-gauge-channel"
              getAriaValueText={seconds}
              index={index}
              key={`tape-${index}`}
            >
              <Meter.Indicator className="rhea-gauge-level" />
            </Meter.Channel>
          )}
        </Meter.Channels>
        {SECONDS.map((second) => (
          <Meter.Mark className="rhea-gauge-mark" key={second} value={second}>
            {second}
          </Meter.Mark>
        ))}
      </Meter.Root>
      <span aria-hidden="true" className="rhea-gauge-label">
        Tape left, seconds
      </span>
    </div>
  );
}
