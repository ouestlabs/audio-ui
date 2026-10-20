const SPOKES = [0, 120, 240];

/** A tape reel: a hub with three spokes, turning while the tape runs. */
export function Reel({
  playing,
  seconds,
}: {
  playing: boolean;
  seconds: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="deneb-reel"
      data-playing={playing || undefined}
      style={{ "--turn": `${seconds}s` } as React.CSSProperties}
    >
      <div className="deneb-reel-wheel">
        {SPOKES.map((angle) => (
          <span
            className="deneb-reel-spoke"
            key={angle}
            style={{ rotate: `${angle}deg` }}
          />
        ))}
        <span className="deneb-reel-hub" />
      </div>
    </div>
  );
}
