import { useEffect, useRef } from "react";

/** The four cells round the bulb: where each sits, and which way its face turns. */
const CELLS = [
  { angle: 0, x: 100, y: 34 },
  { angle: 90, x: 166, y: 100 },
  { angle: 180, x: 100, y: 166 },
  { angle: 270, x: 34, y: 100 },
] as const;
/** A cell's face: the serpentine track of cadmium sulfide between its two electrodes. */
const TRACK = "M-9 -7.5 H9 V-4.5 H-9 V-1.5 H9 V1.5 H-9 V4.5 H9 V7.5 H-9";
/** The filament: a coil strung between two posts. */
const FILAMENT =
  "M88 106 L91 98 L94 106 L97 98 L100 106 L103 98 L106 106 L109 98 L112 106";

/**
 * The window on the light box: a bulb in the middle and four photocells facing
 * it. The bulb glows with the lamp's wave as the engine plays it, read off an
 * analyser and written to a CSS variable outside React, so the picture pulses
 * with the sound and no render runs a frame.
 */
export function LampWindow({ lamp }: { lamp: AnalyserNode | null }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lamp) {
      return;
    }
    const samples = new Float32Array(lamp.fftSize);
    let frame = 0;
    const follow = () => {
      lamp.getFloatTimeDomainData(samples);
      // The wave's series overshoots its ends a little: the light stays between dark and full.
      const light = Math.min(1, Math.max(0, ((samples.at(-1) ?? 0) + 1) / 2));
      root.current?.style.setProperty("--glow", light.toFixed(3));
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [lamp]);

  return (
    <div aria-hidden="true" className="luma-window" ref={root}>
      <svg aria-hidden="true" className="luma-box" viewBox="0 0 200 200">
        <circle className="luma-halo" cx={100} cy={100} r={58} />
        {CELLS.map((cell) => (
          <g
            className="luma-cell"
            key={cell.angle}
            transform={`translate(${cell.x} ${cell.y}) rotate(${cell.angle})`}
          >
            <rect
              className="luma-cell-can"
              height={30}
              rx={3}
              width={30}
              x={-15}
              y={-15}
            />
            <circle className="luma-cell-face" r={12} />
            <path className="luma-cell-track" d={TRACK} />
          </g>
        ))}
        <rect
          className="luma-socket"
          height={22}
          rx={3}
          width={30}
          x={85}
          y={124}
        />
        <circle className="luma-bulb" cx={100} cy={100} r={28} />
        <line className="luma-post" x1={88} x2={90} y1={106} y2={128} />
        <line className="luma-post" x1={112} x2={110} y1={106} y2={128} />
        <path className="luma-filament" d={FILAMENT} />
        <circle className="luma-glare" cx={91} cy={88} r={6} />
      </svg>
    </div>
  );
}
