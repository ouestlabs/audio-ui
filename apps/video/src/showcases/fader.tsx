import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { clamp, MOTION, ramp, tw } from "../motion.ts";

const FADERS = [
  { from: 22, label: "Volume", to: 78 },
  { from: 72, label: "Send", to: 36 },
];
const MARKS = [0, 25, 50, 75, 100];
const percent = (value: number) => `${Math.round(value)}%`;

/** A volume and a send, pushed in opposite ways. */
export function FaderShowcase({ t }: { t: number }) {
  return (
    <div className="flex h-full flex-col justify-center gap-8">
      {FADERS.map((fader, index) => {
        const start = 0.1 + index * 0.15;
        const drift =
          4 *
          Math.sin((t - start) * 1.7 + index * 2) *
          ramp(t - start - 0.9, 0.8);
        const value = clamp(
          tw(t, start, start + 0.9, fader.from, fader.to, MOTION.enter) + drift,
          0,
          100
        );
        return (
          <div className="flex items-center gap-4" key={fader.label}>
            <span className="w-14 shrink-0 text-muted-foreground text-xs">
              {fader.label}
            </span>
            <Fader
              aria-label={fader.label}
              formatValue={percent}
              marks={MARKS}
              max={100}
              min={0}
              orientation="horizontal"
              step={1}
              value={value}
              valueLabel="hidden"
            />
            <span className="w-12 shrink-0 text-end font-mono text-muted-foreground text-xs tabular-nums">
              {percent(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
