import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

const ROOT = 48;
/** C, Am, F, G: a bass note held, the chord's notes arpeggiated an octave up. */
const CHORDS = [
  [0, 4, 7],
  [9, 12, 16],
  [5, 9, 12],
  [7, 11, 14],
];
const START = 0.35;
const NOTES_PER_SECOND = 5;

/** A chord progression, arpeggiated over a held bass. */
export function PianoShowcase({ t }: { t: number }) {
  let active: number[] = [];
  if (t > START) {
    const chord = CHORDS[Math.floor(t - START) % CHORDS.length] ?? [];
    const note =
      chord[Math.floor((t - START) * NOTES_PER_SECOND) % chord.length] ?? 0;
    active = [ROOT + (chord[0] ?? 0), ROOT + Math.min(note + 12, 23)];
  }
  return (
    <div className="flex h-full items-center">
      <Piano
        activeNotes={active}
        aria-label="Piano"
        className="h-full"
        maxPitch={ROOT + 23}
        minPitch={ROOT}
      />
    </div>
  );
}
