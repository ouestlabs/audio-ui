import { pitchName } from "@audio-ui/core/pitch";
import { Fader } from "@audio-ui/react/fader";
import { useCallback } from "react";

/** The finger's place below the lowest string, where it waits between strums; a step above the highest is silent too, so no string lies on the edge. */
export const REST = -1;

/**
 * The strum plate: a strip of brushed metal with thirteen strings engraved
 * across it, low at the bottom, each with the note it plays now. It is a
 * fader of one step a string: a finger dragged over it strikes every string
 * it crosses, a tap strikes the one under it, and the arrow keys walk the
 * strings one by one. Below the lowest string is where the finger rests.
 */
export function Plate({
  onCommit,
  onStrum,
  strings,
  value,
}: {
  onCommit: (value: number, reason: string) => void;
  onStrum: (value: number, reason: string) => void;
  strings: readonly number[];
  value: number;
}) {
  const strum = useCallback(
    (next: number, details: { reason: string }) =>
      onStrum(next, details.reason),
    [onStrum]
  );
  const commit = useCallback(
    (next: number, details: { reason: string }) =>
      onCommit(next, details.reason),
    [onCommit]
  );
  const valueText = useCallback(
    (_formatted: string, current: number) => {
      const pitch = strings[current];
      if (pitch !== undefined) {
        return `String ${current + 1}, ${pitchName(pitch)}`;
      }
      return current === REST ? "Resting" : "Above the strings";
    },
    [strings]
  );
  return (
    <Fader.Root
      className="sera-plate"
      data-resting={value === REST || undefined}
      largeStep={4}
      max={strings.length}
      min={REST}
      onValueChange={strum}
      onValueCommitted={commit}
      orientation="vertical"
      step={1}
      value={value}
    >
      <Fader.Label className="sera-plate-label">Strum</Fader.Label>
      <Fader.Control className="sera-plate-surface">
        {strings.map((pitch, index) => (
          <span
            aria-hidden="true"
            className="sera-string"
            data-struck={index === value || undefined}
            key={pitch}
            style={{ bottom: `${((index + 1) / (strings.length + 1)) * 100}%` }}
          >
            <span className="sera-string-name">{pitchName(pitch)}</span>
          </span>
        ))}
        <Fader.Thumb className="sera-finger" getAriaValueText={valueText} />
      </Fader.Control>
    </Fader.Root>
  );
}
