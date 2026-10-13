import { START_ANGLE, SWEEP_ANGLE } from "@audio-ui/core/knob";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { LOGO_NOTCH_ANGLE } from "../brand.tsx";
import { activeRing, clamp, MOTION, pressed, ramp, tw } from "../motion.ts";

/** The first knob rests where the logo points, so the intro's glyph lands on it as it is. */
export const CUTOFF_AT_REST =
  ((((LOGO_NOTCH_ANGLE - START_ANGLE) % 360) + 360) % 360) / SWEEP_ANGLE;

const KNOBS = [
  {
    format: (value: number) => {
      const hertz = 20 * 1000 ** value;
      return hertz >= 1000
        ? `${(hertz / 1000).toFixed(1)} kHz`
        : `${Math.round(hertz)} Hz`;
    },
    from: CUTOFF_AT_REST,
    label: "Cutoff",
    // On clockwise, the way the intro's glyph was spinning.
    to: 0.8,
  },
  {
    format: (value: number) => value.toFixed(2),
    from: 0.2,
    label: "Resonance",
    to: 0.55,
  },
  {
    format: (value: number) => `+${(value * 24).toFixed(1)} dB`,
    from: 0.1,
    label: "Drive",
    to: 0.62,
  },
  {
    format: (value: number) => `${Math.round(value * 100)}%`,
    from: 0.5,
    label: "Mix",
    to: 0.85,
  },
];

/** When the knob at `index` starts turning: one after the other, close together. */
const startOf = (index: number) => 0.1 + index * 0.08;

/** The value of the knob at `index`, `t` seconds after the panel came on screen. */
export function knobValue(index: number, t: number) {
  const knob = KNOBS[index];
  if (!knob) {
    return 0;
  }
  const start = startOf(index);
  // Once turned, it keeps moving: a slow sweep round where it was set.
  const drift =
    0.08 *
    Math.sin((t - start - 0.9) * 1.6 + index) *
    ramp(t - start - 0.7, 0.8);
  // A hand turning it: it moves at once, then settles.
  const turned = tw(t, start, start + 0.9, knob.from, knob.to, MOTION.enter);
  return clamp(turned + drift, 0, 1);
}

/** The focus ring of the knob at `index` while it is being turned. */
export const knobRing = (index: number, t: number) =>
  activeRing(pressed(t, startOf(index)));

/** Four knobs of a filter, turned one after the other, then drifting. */
export function KnobShowcase({ t }: { t: number }) {
  return (
    <div className="grid h-full grid-cols-4 items-center">
      {KNOBS.map((knob, index) => (
        <div className="flex flex-col items-center gap-2" key={knob.label}>
          <span className="text-muted-foreground text-xs">{knob.label}</span>
          <Knob
            aria-label={knob.label}
            formatValue={knob.format}
            max={1}
            min={0}
            size="lg"
            step={0.001}
            style={knobRing(index, t)}
            value={knobValue(index, t)}
            valueLabel="always"
          />
        </div>
      ))}
    </div>
  );
}
