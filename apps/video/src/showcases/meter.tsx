import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { lerp, MOTION, ramp } from "../motion.ts";

const MARKS = [0, -6, -12, -24, -48];
const FLOOR = -60;
const PEAK_HOLD_FRAMES = 16;
const PEAK_HOLD_STEP = 0.06;

/** A kick on every half second, with some movement on top, in dBFS. */
const signal = (t: number, channel: number) => {
  const beat = (1 - ((((t * 2) % 1) + 1) % 1)) ** 2.2;
  const movement =
    0.5 +
    0.5 * Math.sin(t * 13.1 + channel * 1.7) * Math.sin(t * 5.3 + channel);
  return -40 + 39 * (0.6 * beat + 0.4 * movement);
};

/** A stereo meter on a drum loop, with its peak hold. */
export function MeterShowcase({ t }: { t: number }) {
  const on = MOTION.enter(ramp(t, 0.8));
  const levels = [0, 1].map((channel) => lerp(FLOOR, signal(t, channel), on));
  const peaks = [0, 1].map((channel) => {
    let peak = FLOOR;
    for (let step = 0; step < PEAK_HOLD_FRAMES; step += 1) {
      peak = Math.max(peak, signal(t - step * PEAK_HOLD_STEP, channel));
    }
    return lerp(FLOOR, peak, on);
  });
  return (
    <div className="flex h-full items-center justify-center">
      <Meter
        aria-label="Output"
        className="h-full"
        marks={MARKS}
        min={FLOOR}
        peak={peaks}
        size="lg"
        value={levels}
        warnThreshold={-6}
      />
    </div>
  );
}
