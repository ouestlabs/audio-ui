import { type KeyboardEvent, useCallback } from "react";
import { type Chord, chordName, chordSpoken } from "../audio/chords";

/**
 * One of the 27 chord buttons: pressing it chooses the chord for the strings
 * and the rhythm, and sounds the pad for as long as it is held, by pointer or
 * by Enter and Space.
 */
export function ChordButton({
  chord,
  onPress,
  onRelease,
  selected,
}: {
  chord: Chord;
  onPress: (chord: Chord) => void;
  onRelease: () => void;
  selected: boolean;
}) {
  const press = useCallback(() => onPress(chord), [chord, onPress]);
  const keyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        press();
      }
    },
    [press]
  );
  const keyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        onRelease();
      }
    },
    [onRelease]
  );
  return (
    <button
      aria-label={chordSpoken(chord)}
      aria-pressed={selected}
      className="sera-chord"
      data-quality={chord.quality}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onPointerCancel={onRelease}
      onPointerDown={press}
      onPointerLeave={onRelease}
      onPointerUp={onRelease}
      type="button"
    >
      <span
        aria-hidden="true"
        className="sera-led"
        data-on={selected || undefined}
      />
      {chordName(chord)}
    </button>
  );
}
