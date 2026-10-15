"use client";

import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";

/** A keyboard from C3 to C5. With a MIDI keyboard connected, the keys you hold on it light up here. */
export default function PianoSizeDefaultDemo() {
  const midi = useMidiInput();
  return (
    <Piano
      activeNotes={midi.activeNotes}
      aria-label="Piano"
      maxPitch={72}
      minPitch={48}
    />
  );
}
