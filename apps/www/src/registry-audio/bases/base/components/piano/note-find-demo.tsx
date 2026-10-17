"use client";

import {
  findNotes,
  type Note,
  type NoteId,
  type NoteQuery,
} from "@audio-ui/core/piano-roll";
import type { Scale } from "@audio-ui/core/pitch";
import { useCallback, useState } from "react";
import { NoteFind } from "@/registry-audio/bases/base/audio/elements/note-find";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollViewport,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import { Timeline } from "@/registry-audio/bases/base/audio/elements/timeline";

const SCALE: Scale = { name: "major", root: 0 };

const PHRASE: Note[] = [
  { id: "1", length: 2, pitch: 60, start: 0, velocity: 0.9 },
  { id: "2", length: 2, pitch: 64, start: 2, velocity: 0.5 },
  { id: "3", length: 2, pitch: 67, start: 4, velocity: 0.8 },
  { id: "4", length: 2, pitch: 70, start: 6, velocity: 1 },
  { id: "5", length: 1, pitch: 71, start: 8, velocity: 0.4 },
  { id: "6", length: 1, pitch: 67, start: 9, velocity: 0.7 },
  { id: "7", length: 2, pitch: 66, start: 10, velocity: 0.6 },
  { id: "8", length: 4, pitch: 62, start: 12, muted: true, velocity: 0.8 },
];

/** Find notes by what they are: the ones found are selected on the roll. */
export default function NoteFindDemo() {
  const [notes, setNotes] = useState(PHRASE);
  const [selection, setSelection] = useState<readonly NoteId[]>([]);
  const selectFound = useCallback(
    (query: NoteQuery) => setSelection(findNotes(notes, query)),
    [notes]
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {selection.length} of {notes.length} notes selected
        </p>
        <NoteFind onFind={selectFound} scale={SCALE} />
      </div>
      <Timeline duration={16} snapStep={1}>
        <PianoRoll
          className="h-64 rounded-md border"
          maxPitch={72}
          minPitch={60}
          onSelectionChange={setSelection}
          onValueChange={setNotes}
          scale={SCALE}
          selection={selection}
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
