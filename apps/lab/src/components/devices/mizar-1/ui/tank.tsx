import type { Source } from "@audio-ui/core";
import { useEffect, useMemo, useRef } from "react";
import { useAudioLevels } from "@/hooks/use-audio-levels";

const TURNS = 30;
const WIDTH = 400;
const SPRINGS = [
  { id: "long", y: 38 },
  { id: "short", y: 82 },
] as const;

/** One spring's coil: a line that goes up and down along its length, as a wire wound on a rod looks from the side. */
function coil(y: number) {
  const left = 26;
  const right = WIDTH - 26;
  const step = (right - left) / TURNS;
  let path = `M ${left} ${y}`;
  for (let turn = 0; turn < TURNS; turn += 1) {
    const x = left + turn * step;
    path += ` C ${x + step * 0.1} ${y - 15}, ${x + step * 0.7} ${y - 15}, ${x + step} ${y}`;
    path += ` C ${x + step * 0.9} ${y + 15}, ${x + step * 0.3} ${y + 15}, ${x + step} ${y}`;
  }
  return path;
}

const COILS = SPRINGS.map((spring) => ({ ...spring, path: coil(spring.y) }));

/** The decibels from which the springs begin to shake, and from which they shake as hard as they do. */
const FLOOR_DB = -55;
const FULL_DB = -15;

/**
 * The tank: two springs on their hooks, shaking with the sound that goes
 * through them. Their shake is a CSS variable written outside React from the
 * output's level, so the picture follows the signal with no render a frame.
 */
export function Tank({
  analyser,
  bumped,
}: {
  analyser: AnalyserNode | null;
  bumped: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => (analyser ? [analyser] : []), [analyser]);
  const levels = useAudioLevels(nodes);

  useEffect(() => {
    const follow = () => {
      const [db] = (
        levels as Source<{ levels: readonly number[] }>
      ).getSnapshot().levels;
      const amount = Math.min(
        1,
        Math.max(0, ((db ?? FLOOR_DB) - FLOOR_DB) / (FULL_DB - FLOOR_DB))
      );
      root.current?.style.setProperty("--shake", amount.toFixed(3));
    };
    follow();
    return (levels as Source<{ levels: readonly number[] }>).subscribe(follow);
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
        {COILS.map((spring) => (
          <g className="mizar-spring" data-spring={spring.id} key={spring.id}>
            <line
              className="mizar-rod"
              x1={10}
              x2={WIDTH - 10}
              y1={spring.y}
              y2={spring.y}
            />
            <path className="mizar-coil-back" d={spring.path} fill="none" />
            <path className="mizar-coil" d={spring.path} fill="none" />
            <circle className="mizar-hook" cx={14} cy={spring.y} r={5} />
            <circle
              className="mizar-hook"
              cx={WIDTH - 14}
              cy={spring.y}
              r={5}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
