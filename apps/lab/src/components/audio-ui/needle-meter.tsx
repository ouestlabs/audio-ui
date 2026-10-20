"use client";

import type { Source } from "@audio-ui/core";
import {
  createVuBallistics,
  FLOOR_DB,
  levelPosition,
  vuDeflection,
} from "@audio-ui/core/meter";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** The reading a needle meter follows: the levels of its channels, in dB. */
export interface NeedleMeterFrame {
  levels: readonly number[];
}

/** The needle's travel, in degrees from the vertical: it rests at the left and ends at the right. */
const SWEEP = 70;
const PIVOT_X = 100;
const PIVOT_Y = 104;
const RADIUS = 88;

/** The marks of the standard VU scale, in VU: from -20 to +3, the part from 0 up in red. */
const MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3] as const;
const FIRST_MARK = -20;
const LAST_MARK = 3;

/** The fraction of the needle's travel at a level in VU: it follows the voltage, and rests at zero voltage. */
const position = levelPosition(
  vuDeflection,
  Number.NEGATIVE_INFINITY,
  LAST_MARK
);

const sweepAt = (vu: number) => -SWEEP + position(vu) * 2 * SWEEP;

/** The lean of the scale: the needle's travel starts at zero voltage, so the first mark is not as far from the left stop as the last is from the right one. */
const LEAN = (sweepAt(FIRST_MARK) + sweepAt(LAST_MARK)) / 2;

/** The angle of a level, in degrees from the vertical, with the printed scale centered on it. */
const angleOf = (vu: number) => sweepAt(vu) - LEAN;

const pointOn = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: PIVOT_X + radius * Math.sin(radians),
    y: PIVOT_Y - radius * Math.cos(radians),
  };
};

const TICK_WIDTH = 1.5;
const ARC_WIDTH = 1;
const ZONE_WIDTH = 3;

/** The angle half a tick takes along the outer edge of the marks. */
const TICK_MARGIN = ((TICK_WIDTH / 2 / RADIUS) * 180) / Math.PI;

/** An arc between two angles along the outer edge of the marks, `width` thick and inside that edge. */
const arcBetween = (from: number, to: number, width: number) => {
  const radius = RADIUS - width / 2;
  const start = pointOn(from, radius);
  const end = pointOn(to, radius);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
};

const SCALE = MARKS.map((mark) => {
  const angle = angleOf(mark);
  return {
    hot: mark > 0,
    inner: pointOn(angle, RADIUS - 8),
    label: mark > 0 ? `+${mark}` : String(Math.abs(mark)),
    mark,
    outer: pointOn(angle, RADIUS),
    text: pointOn(angle, RADIUS + 10),
  };
});
// The scale line and the red band run half a tick past their end marks, so no tick sticks out.
const SCALE_ARC = arcBetween(
  angleOf(FIRST_MARK) - TICK_MARGIN,
  angleOf(0) + TICK_MARGIN,
  ARC_WIDTH
);
const ZONE_ARC = arcBetween(
  angleOf(0) - TICK_MARGIN,
  angleOf(LAST_MARK) + TICK_MARGIN,
  ZONE_WIDTH
);
const TIP = pointOn(0, RADIUS - 6);

export interface NeedleMeterProps {
  "aria-label": string;
  className?: string;
  /** The level of the source, in dB, that reads 0 VU. The standard sets none: a studio aligns 0 VU to a level of its own, and -18 dB is a common one for digital audio. @default -18 */
  reference?: number;
  /** A live signal, read each frame outside React: the needle follows its first channel. */
  source: Source<NeedleMeterFrame>;
}

/**
 * A VU meter: the standard dial, from -20 to +3 VU with its marks spread by
 * voltage and the part above 0 in red, and a needle with the standard
 * ballistics, 300 ms to 99% of a step and a 1.3% overshoot. The needle is
 * turned straight in the DOM each frame, so the dial does not re-render with
 * the signal.
 */
export function NeedleMeter({
  "aria-label": ariaLabel,
  className,
  reference = -18,
  source,
}: NeedleMeterProps) {
  const needleRef = useRef<SVGLineElement>(null);
  const readingRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    const needle = needleRef.current;
    if (!needle) {
      return;
    }
    const meter = createVuBallistics();
    let frame = 0;
    let last = performance.now();
    let shown = Number.NaN;
    const tick = (now: number) => {
      const level = source.getSnapshot().levels[0] ?? FLOOR_DB;
      const vu = meter.step(level - reference, (now - last) / 1000);
      last = now;
      needle.style.transform = `rotate(${angleOf(vu)}deg)`;
      const rounded = Math.round(vu);
      if (readingRef.current && rounded !== shown) {
        shown = rounded;
        readingRef.current.textContent = `${rounded <= FLOOR_DB ? "-∞" : rounded} VU`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reference, source]);

  return (
    <figure
      aria-label={ariaLabel}
      className={cn(
        "flex w-full max-w-sm flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground",
        className
      )}
      data-slot="needle-meter"
      role="img"
    >
      <svg aria-hidden="true" className="w-full" viewBox="0 0 200 110">
        <path
          className="stroke-muted-foreground"
          d={SCALE_ARC}
          fill="none"
          strokeWidth={ARC_WIDTH}
        />
        <path
          className="stroke-destructive"
          d={ZONE_ARC}
          fill="none"
          strokeWidth={ZONE_WIDTH}
        />
        {SCALE.map(({ hot, inner, label, mark, outer, text }) => (
          <g key={mark}>
            <line
              className={cn(
                "stroke-muted-foreground",
                hot && "stroke-destructive"
              )}
              strokeWidth={TICK_WIDTH}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
            <text
              className={cn(
                "fill-muted-foreground text-[8px]",
                hot && "fill-destructive"
              )}
              dominantBaseline="central"
              textAnchor="middle"
              x={text.x}
              y={text.y}
            >
              {label}
            </text>
          </g>
        ))}
        <line
          className="stroke-primary stroke-2"
          ref={needleRef}
          strokeLinecap="round"
          strokeWidth={2}
          style={{
            transform: `rotate(${angleOf(Number.NEGATIVE_INFINITY)}deg)`,
            transformBox: "view-box",
            transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
          }}
          x1={PIVOT_X}
          x2={TIP.x}
          y1={PIVOT_Y}
          y2={TIP.y}
        />
        <rect
          className="[rx:calc(var(--radius)*0.5)] fill-primary"
          height={8}
          width={8}
          x={PIVOT_X - 4}
          y={PIVOT_Y - 4}
        />
      </svg>
      <figcaption className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{`0 VU = ${reference} dB`}</span>
        <output ref={readingRef}>-∞ VU</output>
      </figcaption>
    </figure>
  );
}
