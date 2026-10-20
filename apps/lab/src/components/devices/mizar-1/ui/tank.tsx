import type { Source } from "@audio-ui/core";
import { useEffect, useId, useMemo, useRef } from "react";
import { useAudioLevels } from "@/hooks/use-audio-levels";

const WIDTH = 400;
/** The spring's body, between its two tails, and how it is wound: close, each turn a slant across the tube. */
const BODY_LEFT = 44;
const BODY_RIGHT = WIDTH - 44;
const TURNS = 44;
const PITCH = (BODY_RIGHT - BODY_LEFT) / TURNS;
const TUBE = 6.5;
const SPRINGS = [
  { id: "long", y: 40 },
  { id: "short", y: 80 },
] as const;

const TURN_LIST = Array.from({ length: TURNS }, (_, index) => ({
  index,
  /** Where the turn is along the spring, from 0 to 180 degrees: the shake is the greatest in the middle, as a plucked string's. */
  phase: ((index + 0.5) / TURNS) * 180,
  x: BODY_LEFT + index * PITCH,
}));

/** The decibels from which the springs begin to shake, and from which they shake as hard as they do. */
const FLOOR_DB = -55;
const FULL_DB = -15;

type Levels = Source<{ levels: readonly number[] }>;

/**
 * The tank: two springs on their hooks, each a coil of shaded turns that sags a
 * little under its own weight and shakes as a standing wave with the sound that
 * goes through it. The shake is a CSS variable written outside React from the
 * output's level, so the picture follows the signal with no render a frame.
 */
export function Tank({
  analyser,
  bumped,
}: {
  analyser: AnalyserNode | null;
  bumped: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => (analyser ? [analyser] : []), [analyser]);
  const levels = useAudioLevels(nodes);

  useEffect(() => {
    const follow = () => {
      const [db] = (levels as Levels).getSnapshot().levels;
      const amount = Math.min(
        1,
        Math.max(0, ((db ?? FLOOR_DB) - FLOOR_DB) / (FULL_DB - FLOOR_DB))
      );
      root.current?.style.setProperty("--shake", amount.toFixed(3));
    };
    follow();
    return (levels as Levels).subscribe(follow);
  }, [levels]);

  return (
    <div
      aria-hidden="true"
      className="mizar-tank"
      data-bumped={bumped || undefined}
      ref={root}
    >
      <svg
        aria-hidden="true"
        className="mizar-tank-svg"
        viewBox={`0 0 ${WIDTH} 120`}
      >
        <defs>
          <linearGradient id={`${id}-tube`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2a343a" />
            <stop offset="0.3" stopColor="#d5dfe4" />
            <stop offset="0.45" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#7d8a93" />
            <stop offset="1" stopColor="#222b31" />
          </linearGradient>
          <linearGradient id={`${id}-bar`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#58636b" />
            <stop offset="0.5" stopColor="#c9d3d9" />
            <stop offset="1" stopColor="#58636b" />
          </linearGradient>
          <linearGradient id={`${id}-pan`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#4c575f" />
            <stop offset="1" stopColor="#1b2227" />
          </linearGradient>
        </defs>
        <rect
          fill={`url(#${id}-pan)`}
          height={112}
          rx={6}
          stroke="#7b868d"
          strokeWidth={1.2}
          width={WIDTH - 4}
          x={2}
          y={4}
        />
        <rect
          className="mizar-cavity"
          height={98}
          rx={4}
          width={WIDTH - 20}
          x={10}
          y={11}
        />
        {[
          { side: "left", x: 12 },
          { side: "right", x: WIDTH - 28 },
        ].map((bar) => (
          <g key={bar.side}>
            <rect
              fill={`url(#${id}-bar)`}
              height={84}
              rx={2.5}
              stroke="#12171a"
              strokeWidth={0.8}
              width={16}
              x={bar.x}
              y={18}
            />
            {[24, 96].map((y) => (
              <circle
                className="mizar-bolt"
                cx={bar.x + 8}
                cy={y}
                key={y}
                r={2.1}
              />
            ))}
          </g>
        ))}
        {SPRINGS.map((spring) => (
          <g className="mizar-spring" data-spring={spring.id} key={spring.id}>
            <ellipse
              className="mizar-shadow"
              cx={WIDTH / 2}
              cy={spring.y + 10}
              rx={(BODY_RIGHT - BODY_LEFT) / 2}
              ry={2.6}
            />
            <circle className="mizar-eyelet" cx={20} cy={spring.y} r={3.4} />
            <circle
              className="mizar-eyelet"
              cx={WIDTH - 20}
              cy={spring.y}
              r={3.4}
            />
            <line
              className="mizar-tail"
              x1={20}
              x2={BODY_LEFT}
              y1={spring.y}
              y2={spring.y}
            />
            <line
              className="mizar-tail"
              x1={BODY_RIGHT}
              x2={WIDTH - 20}
              y1={spring.y}
              y2={spring.y}
            />
            <rect
              fill={`url(#${id}-tube)`}
              height={TUBE * 2}
              rx={TUBE}
              width={BODY_RIGHT - BODY_LEFT}
              x={BODY_LEFT}
              y={spring.y - TUBE}
            />
            {TURN_LIST.map((turn) => (
              <g
                className="mizar-turn"
                key={turn.index}
                style={
                  {
                    "--i": turn.index,
                    "--p": `${turn.phase}deg`,
                  } as React.CSSProperties
                }
              >
                <line
                  className="mizar-groove"
                  x1={turn.x}
                  x2={turn.x + PITCH * 0.9}
                  y1={spring.y - TUBE + 0.6}
                  y2={spring.y + TUBE - 0.6}
                />
                <line
                  className="mizar-ridge"
                  x1={turn.x + PITCH * 0.45}
                  x2={turn.x + PITCH * 1.35}
                  y1={spring.y - TUBE + 0.6}
                  y2={spring.y + TUBE - 0.6}
                />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
