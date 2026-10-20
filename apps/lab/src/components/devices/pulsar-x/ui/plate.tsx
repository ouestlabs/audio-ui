import { pitchName } from "@audio-ui/core/pitch";
import { XYPad } from "@audio-ui/react/xypad";
import { inScale, ROOT, type Scale, SPAN } from "../audio/scales";

const NOTES = Array.from({ length: SPAN + 1 }, (_, note) => note);
const ROWS = [25, 50, 75] as const;

/** The plate: a glass surface with a line under every note it can play, the notes of the scale lit, a finger's place marked by a glowing dot. */
export function Plate({
  onKeyDown,
  onPoint,
  onPress,
  point,
  scale,
  touching,
}: {
  onKeyDown: (event: React.KeyboardEvent) => void;
  onPoint: (point: { x: number; y: number }) => void;
  onPress: () => void;
  point: { x: number; y: number };
  scale: Scale;
  touching: boolean;
}) {
  return (
    <XYPad.Root
      className="pulsar-plate"
      data-touching={touching || undefined}
      maxX={SPAN}
      maxY={100}
      minX={0}
      minY={0}
      onKeyDown={onKeyDown}
      onPointerDownCapture={onPress}
      onValueChange={onPoint}
      stepX={scale === "Free" ? 0.05 : 1}
      stepY={1}
      value={point}
    >
      <XYPad.Label className="pulsar-plate-label">
        Pitch across, brightness up
      </XYPad.Label>
      <XYPad.Control className="pulsar-plate-surface">
        {NOTES.map((note) => (
          <span
            aria-hidden="true"
            className="pulsar-note-line"
            data-in-scale={inScale(note, scale) || undefined}
            data-octave={note % 12 === 0 || undefined}
            key={note}
            style={{ left: `${(note / SPAN) * 100}%` }}
          >
            {note % 12 === 0 ? (
              <span className="pulsar-note-name">{pitchName(ROOT + note)}</span>
            ) : null}
          </span>
        ))}
        {ROWS.map((row) => (
          <span
            aria-hidden="true"
            className="pulsar-row-line"
            key={row}
            style={{ top: `${row}%` }}
          />
        ))}
        <XYPad.Thumb className="pulsar-dot" />
      </XYPad.Control>
    </XYPad.Root>
  );
}
