import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";
import { activeRing, MOTION, ramp } from "../motion.ts";

const describe = ({ x, y }: { x: number; y: number }) =>
  `${Math.round(30 * (1046 / 30) ** (x / 100))} Hz, ${Math.round(200 * 40 ** (y / 100))} Hz`;

/** A pitch and a cutoff, drawn as a Lissajous figure. */
export function XYPadShowcase({ t }: { t: number }) {
  const time = Math.max(t, 0);
  const amplitude = MOTION.move(ramp(t, 0.9));
  const value = {
    x: 50 + 33 * amplitude * Math.sin(time * 1.25),
    y: 50 + 30 * amplitude * Math.sin(time * 2.05),
  };
  // The ring goes round the pad itself: its `style` would land on the root, which only wraps it.
  return (
    <div
      className="flex h-full flex-col rounded-xl"
      style={activeRing(MOTION.move(ramp(t, 0.5)))}
    >
      <XYPad
        aria-label="Pitch and cutoff"
        fill
        formatValue={describe}
        maxX={100}
        maxY={100}
        minX={0}
        minY={0}
        size="sm"
        value={value}
      />
    </div>
  );
}
