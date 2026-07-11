"use client";

import { useEffect, useState } from "react";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

const CHORD_NOTES = [48, 52, 55];
const TOGGLE_MS = 900;

/** Simulated external source (a MIDI input, a sequencer) driving activeNotes independently of pointer presses. */
export default function PianoActiveNotesDemo() {
  const [chordOn, setChordOn] = useState(true);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setChordOn((current) => !current);
    }, TOGGLE_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <Piano
      activeNotes={chordOn ? CHORD_NOTES : []}
      aria-label="Piano"
      endNote={72}
      startNote={48}
    />
  );
}
