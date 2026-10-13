import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";
import { MOTION, noise, ramp } from "../motion.ts";

const BARS = 120;
const DURATION = 8;
const PEAKS = Array.from(
  { length: BARS },
  (_, index) =>
    0.18 +
    0.82 *
      (0.45 * noise(index) +
        0.55 * Math.abs(Math.sin(index * 0.19) * Math.cos(index * 0.053)))
);

const clock = (seconds: number) =>
  `0:${String(Math.floor(seconds)).padStart(2, "0")}`;

/** A loop playing: the bars rise from the left, then the playhead runs across them. */
export function WaveformShowcase({ t }: { t: number }) {
  const position = (Math.max(t, 0) * 1.3) % DURATION;
  const peaks = PEAKS.map(
    (peak, index) => peak * MOTION.move(ramp(t - index * 0.004, 0.55))
  );
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex justify-between text-muted-foreground text-xs">
        <span>loop-120bpm.wav</span>
        <span className="font-mono tabular-nums">
          {clock(position)} / {clock(DURATION)}
        </span>
      </div>
      <Waveform
        aria-label="Track progress"
        className="h-20"
        duration={DURATION}
        value={position}
        values={peaks}
        variant="playhead"
      />
    </div>
  );
}
