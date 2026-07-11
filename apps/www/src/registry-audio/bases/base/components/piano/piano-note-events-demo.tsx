"use client";

import { useCallback, useState } from "react";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

export default function PianoNoteEventsDemo() {
  const [lastNote, setLastNote] = useState<string>("—");

  const handleNoteOn = useCallback((note: number) => {
    setLastNote(String(note));
  }, []);

  const handleNoteOff = useCallback(() => {
    setLastNote("—");
  }, []);

  return (
    <div className="flex w-full flex-col gap-3">
      <Piano
        aria-label="Piano"
        endNote={72}
        onNoteOff={handleNoteOff}
        onNoteOn={handleNoteOn}
        startNote={48}
      />
      <output className="text-center font-mono text-muted-foreground text-xs">
        Last note on: {lastNote}
      </output>
    </div>
  );
}
