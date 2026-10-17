"use client";

import type { Note } from "@audio-ui/core/piano-roll";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollViewport,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import { Timeline } from "@/registry-audio/bases/base/audio/elements/timeline";
import {
  downloadMidiFile,
  MIDI_FILE_ACCEPT,
  readMidiFile,
} from "@/registry-audio/bases/base/lib/midi-file";

const DURATION = 32;
const MIN_PITCH = 48;
const MAX_PITCH = 84;

const PHRASE: Note[] = [
  { id: "1", length: 4, pitch: 60, start: 0, velocity: 0.9 },
  { id: "2", length: 4, pitch: 64, start: 4, velocity: 0.6 },
  { id: "3", length: 4, pitch: 67, start: 8, velocity: 0.8 },
  { id: "4", length: 4, pitch: 72, start: 12, velocity: 1 },
  { id: "5", length: 8, pitch: 65, start: 16, velocity: 0.7 },
  { id: "6", length: 8, pitch: 62, start: 24, velocity: 0.6 },
];

/** Export the clip as a .mid file, or import one onto its grid, with the file's tempo. */
export default function PianoRollMidiFileDemo() {
  const [notes, setNotes] = useState(PHRASE);
  const [bpm, setBpm] = useState(120);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFile = useCallback(() => inputRef.current?.click(), []);
  const exportFile = useCallback(
    () => downloadMidiFile(notes, { bpm, filename: "clip.mid" }),
    [bpm, notes]
  );
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      const imported = await readMidiFile(file, {
        duration: DURATION,
        maxPitch: MAX_PITCH,
        minPitch: MIN_PITCH,
      });
      setNotes(imported.notes);
      setBpm(imported.bpm);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-muted-foreground text-xs tabular-nums">
          {bpm} BPM
        </p>
        <div className="flex gap-2">
          <input
            accept={MIDI_FILE_ACCEPT}
            className="sr-only"
            onChange={importFile}
            ref={inputRef}
            type="file"
          />
          <Button onClick={openFile} size="sm" variant="outline">
            Import
          </Button>
          <Button disabled={notes.length === 0} onClick={exportFile} size="sm">
            Export
          </Button>
        </div>
      </div>
      <Timeline duration={DURATION} snapStep={1}>
        <PianoRoll
          className="h-64 rounded-md border"
          maxPitch={MAX_PITCH}
          minPitch={MIN_PITCH}
          onValueChange={setNotes}
          value={notes}
        >
          <PianoRollViewport>
            <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
              <PianoRollGrid accentStep={4} aria-label="Notes" gridStep={1} />
            </PianoRollStrip>
          </PianoRollViewport>
        </PianoRoll>
      </Timeline>
    </div>
  );
}
