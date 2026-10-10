"use client";

import { useCallback, useState } from "react";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";

export default function PianoNoteEventsDemo() {
  const [lastNote, setLastNote] = useState<string>("—");

  const handleNoteOn = useCallback((pitch: number) => {
    setLastNote(String(pitch));
  }, []);

  const handleNoteOff = useCallback(() => {
    setLastNote("—");
  }, []);

  return (
    <div className="flex w-full flex-col gap-3">
      <Piano
        aria-label="Piano"
        maxPitch={72}
        minPitch={48}
        onNoteOff={handleNoteOff}
        onNoteOn={handleNoteOn}
      />
      <output className="text-center font-mono text-muted-foreground text-xs">
        Last note on: {lastNote}
      </output>
    </div>
  );
}
