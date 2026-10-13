import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";
import { MOTION, ramp, tw } from "../motion.ts";

/** An ADSR: the attack is pulled out, then the sustain lowered, then both breathe. */
export function EnvelopeShowcase({ t }: { t: number }) {
  const breathe = ramp(t - 1.1, 0.8);
  const attack =
    tw(t, 0.45, 0.9, 0.05, 0.19) + 0.02 * Math.sin(t * 1.4) * breathe;
  const sustain =
    tw(t, 0.7, 1.15, 0.78, 0.46) + 0.06 * Math.sin(t * 1.1 + 1) * breathe;
  const points = [
    { x: 0, y: 0 },
    { x: attack, y: 1 },
    { x: attack + 0.2, y: sustain },
    { x: 0.76, y: sustain },
    { x: 1, y: 0 },
  ];
  return (
    <div
      className="h-full"
      style={{
        clipPath: `inset(-8px ${(1 - MOTION.move(ramp(t, 0.7))) * 100}% -8px -8px)`,
      }}
    >
      <Envelope
        aria-label="ADSR envelope"
        className="h-full"
        maxPoints={5}
        minPoints={5}
        value={points}
        xDomain={[0, 2000]}
        xUnit="ms"
        yDomain={[0, 100]}
        yUnit="%"
      />
    </div>
  );
}
