import { useEffect, useRef } from "react";

/** The needle's travel: it rests at the right, at 0 dB, and swings left as the compressor takes more off. */
const SWEEP = 50;
const PIVOT_X = 100;
const PIVOT_Y = 104;
const RADIUS = 88;
const MAX_DB = 20;
/** The marks of the scale, in dB of reduction: close together at the start, where the ear cares. */
const MARKS = [0, 1, 2, 3, 4, 6, 8, 10, 15, 20] as const;
/** How fast the needle falls back to rest, in dB a second: a compressor's needle is a little slow. */
const FALL_DB_PER_SECOND = 40;

/** The angle of a reduction, from the vertical: the scale is squeezed toward its start so the first decibels are readable. */
const angleOf = (db: number) =>
  SWEEP - 2 * SWEEP * Math.sqrt(Math.min(MAX_DB, Math.max(0, db)) / MAX_DB);

const pointOn = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: PIVOT_X + radius * Math.sin(radians),
    y: PIVOT_Y - radius * Math.cos(radians),
  };
};

const SCALE = MARKS.map((mark) => ({
  hot: mark >= 10,
  inner: pointOn(angleOf(mark), RADIUS - 8),
  mark,
  outer: pointOn(angleOf(mark), RADIUS),
  text: pointOn(angleOf(mark), RADIUS + 10),
}));
const ARC_START = pointOn(angleOf(0), RADIUS - 0.5);
const ARC_END = pointOn(angleOf(MAX_DB), RADIUS - 0.5);
const ZONE_START = pointOn(angleOf(10), RADIUS - 1.5);
const TIP = pointOn(0, RADIUS - 6);
const ARC = `M ${ARC_START.x} ${ARC_START.y} A ${RADIUS - 0.5} ${RADIUS - 0.5} 0 0 0 ${ARC_END.x} ${ARC_END.y}`;
const ZONE = `M ${ZONE_START.x} ${ZONE_START.y} A ${RADIUS - 1.5} ${RADIUS - 1.5} 0 0 0 ${ARC_END.x} ${ARC_END.y}`;

/**
 * The gain reduction meter: how much the compressor is taking off, in dB, read
 * on a dial that rests at the right. `read` is called every frame and gives the
 * reduction as the engine reports it, 0 or negative; the needle is turned
 * straight in the DOM, so the dial does not re-render with the signal.
 */
export function Reduction({ read }: { read: () => number }) {
  const needle = useRef<SVGLineElement>(null);
  const reading = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    let frame = 0;
    let shown = 0;
    let last = performance.now();
    let written = Number.NaN;
    const tick = (now: number) => {
      const target = Math.max(0, -read());
      const fall = FALL_DB_PER_SECOND * ((now - last) / 1000);
      last = now;
      // It goes down at once and comes back at its own speed.
      shown = target > shown ? target : Math.max(target, shown - fall);
      if (needle.current) {
        needle.current.style.transform = `rotate(${angleOf(shown)}deg)`;
      }
      const rounded = Math.round(shown * 10) / 10;
      if (reading.current && rounded !== written) {
        written = rounded;
        reading.current.textContent = `-${rounded.toFixed(1)} dB`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [read]);

  return (
    <figure aria-label="Gain reduction" className="antares-dial" role="img">
      <svg aria-hidden="true" viewBox="0 0 200 110">
        <path className="antares-dial-arc" d={ARC} fill="none" />
        <path className="antares-dial-zone" d={ZONE} fill="none" />
        {SCALE.map(({ hot, inner, mark, outer, text }) => (
          <g key={mark}>
            <line
              className={
                hot ? "antares-dial-tick antares-dial-hot" : "antares-dial-tick"
              }
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
            <text
              className={
                hot
                  ? "antares-dial-label antares-dial-hot"
                  : "antares-dial-label"
              }
              dominantBaseline="central"
              textAnchor="middle"
              x={text.x}
              y={text.y}
            >
              {mark}
            </text>
          </g>
        ))}
        <line
          className="antares-dial-needle"
          ref={needle}
          strokeLinecap="round"
          style={{
            transform: `rotate(${angleOf(0)}deg)`,
            transformBox: "view-box",
            transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
          }}
          x1={PIVOT_X}
          x2={TIP.x}
          y1={PIVOT_Y}
          y2={TIP.y}
        />
        <rect
          className="antares-dial-pivot"
          height={8}
          rx={4}
          width={8}
          x={PIVOT_X - 4}
          y={PIVOT_Y - 4}
        />
      </svg>
      <figcaption className="antares-dial-caption">
        <span>Gain reduction dB</span>
        <output ref={reading}>-0.0 dB</output>
      </figcaption>
    </figure>
  );
}
