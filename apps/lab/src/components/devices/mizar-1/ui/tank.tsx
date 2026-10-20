import type { Source } from "@audio-ui/core";
import { useEffect, useId, useMemo, useRef } from "react";
import { useAudioLevels } from "@/hooks/use-audio-levels";

const WIDTH = 400;
const TURNS = 24;
const LEFT = 30;
const RIGHT = WIDTH - 30;
const STEP = (RIGHT - LEFT) / TURNS;
/** How wide and how tall a turn is, and how far it leans: a coil seen from the side, its wire running diagonally. */
const RADIUS_X = STEP * 0.92;
const RADIUS_Y = 19;
const LEAN = -20;
const SPRINGS = [
  { id: "long", y: 38 },
  { id: "short", y: 82 },
] as const;

/** One turn's two halves: the back one, behind the coil, and the front one, in the light. */
const BACK = `M ${-RADIUS_X} 0 A ${RADIUS_X} ${RADIUS_Y} 0 0 1 ${RADIUS_X} 0`;
const FRONT = `M ${-RADIUS_X} 0 A ${RADIUS_X} ${RADIUS_Y} 0 0 0 ${RADIUS_X} 0`;

const TURN_LIST = Array.from({ length: TURNS }, (_, index) => ({
  index,
  /** Where the turn is along the spring, from 0 to 180 degrees: the shake is the greatest in the middle, as a plucked string's. */
  phase: ((index + 0.5) / TURNS) * 180,
  x: LEFT + (index + 0.5) * STEP,
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
          <linearGradient id={`${id}-wire`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.22" stopColor="#c4cfd6" />
            <stop offset="0.5" stopColor="#6a7780" />
            <stop offset="0.78" stopColor="#cdd8de" />
            <stop offset="1" stopColor="#f4f8fa" />
          </linearGradient>
          <linearGradient id={`${id}-plate`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7b858c" />
            <stop offset="0.5" stopColor="#d6dde1" />
            <stop offset="1" stopColor="#7b858c" />
          </linearGradient>
        </defs>
        {SPRINGS.map((spring) => (
          <g className="mizar-spring" data-spring={spring.id} key={spring.id}>
            <ellipse
              className="mizar-shadow"
              cx={WIDTH / 2}
              cy={spring.y + 27}
              rx={RIGHT - LEFT - 20}
              ry={3.5}
            />
            <rect
              fill={`url(#${id}-plate)`}
              height={34}
              rx={2}
              width={9}
              x={8}
              y={spring.y - 17}
            />
            <rect
              fill={`url(#${id}-plate)`}
              height={34}
              rx={2}
              width={9}
              x={WIDTH - 17}
              y={spring.y - 17}
            />
            {[12.5, WIDTH - 12.5].flatMap((x) =>
              [spring.y - 10, spring.y + 10].map((y) => (
                <circle
                  className="mizar-bolt"
                  cx={x}
                  cy={y}
                  key={`${x}-${y}`}
                  r={1.7}
                />
              ))
            )}
            <line
              className="mizar-hook"
              x1={17}
              x2={LEFT}
              y1={spring.y}
              y2={spring.y}
            />
            <line
              className="mizar-hook"
              x1={RIGHT}
              x2={WIDTH - 17}
              y1={spring.y}
              y2={spring.y}
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
                <g
                  transform={`translate(${turn.x} ${spring.y}) rotate(${LEAN})`}
                >
                  <path className="mizar-coil-back" d={BACK} fill="none" />
                  <path
                    className="mizar-coil-front"
                    d={FRONT}
                    fill="none"
                    stroke={`url(#${id}-wire)`}
                  />
                  <path
                    className="mizar-coil-light"
                    d={FRONT}
                    fill="none"
                    transform="translate(0 -1.1) scale(0.97 1)"
                  />
                </g>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
