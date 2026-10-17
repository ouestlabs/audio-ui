"use client";

import type { Note, NoteId } from "@audio-ui/core/piano-roll";
import { useCallback, useRef, useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/base/ui/dropdown-menu";
import {
  NoteEditMenu,
  NoteEditMenuContent,
  NoteEditMenuSub,
  NoteEditMenuTrigger,
} from "@/registry-audio/bases/base/audio/elements/note-edit-menu";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollVelocity,
  PianoRollVelocityScale,
  PianoRollViewport,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import { Timeline } from "@/registry-audio/bases/base/audio/elements/timeline";
import {
  applyNoteEdit,
  canApplyNoteEdit,
  type NoteEdit,
  PITCH_EDITS,
  TIME_EDITS,
  VELOCITY_EDITS,
} from "@/registry-audio/bases/base/lib/note-edits";

const BOUNDS = { duration: 16, maxPitch: 72, minLength: 1, minPitch: 60 };

const PHRASE: Note[] = [
  { id: "1", length: 2, pitch: 60, start: 0, velocity: 0.9 },
  { id: "2", length: 2, pitch: 64, start: 2, velocity: 0.5 },
  { id: "3", length: 2, pitch: 67, start: 4, velocity: 0.8 },
  { id: "4", length: 2, pitch: 72, start: 6, velocity: 1 },
  { id: "5", length: 1, pitch: 71, start: 9, velocity: 0.4 },
  { id: "6", length: 3, pitch: 67, start: 10, velocity: 0.7 },
  { id: "7", length: 3, pitch: 62, start: 13, velocity: 0.6 },
];

/** Edit the selection, or every note with none selected; Reset is an item of the demo's own, beside the edits. */
export default function NoteEditMenuDemo() {
  const [notes, setNotes] = useState(PHRASE);
  const [selection, setSelection] = useState<readonly NoteId[]>([]);
  const nextIdRef = useRef(0);

  const edit = useCallback(
    (item: NoteEdit) =>
      setNotes(
        applyNoteEdit(item, notes, selection, {
          at: 0,
          bounds: BOUNDS,
          loopEnd: BOUNDS.duration,
          nextId: () => {
            nextIdRef.current += 1;
            return `edit-${nextIdRef.current}`;
          },
          scale: null,
        })
      ),
    [notes, selection]
  );
  const isDisabled = useCallback(
    (item: NoteEdit) =>
      !canApplyNoteEdit(item, {
        hasNotes: notes.length > 0,
        hasScale: false,
        hasSelection: selection.length > 0,
      }),
    [notes.length, selection.length]
  );
  const reset = useCallback(() => setNotes(PHRASE), []);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex justify-end">
        <NoteEditMenu disabled={isDisabled} onEdit={edit}>
          <NoteEditMenuTrigger />
          <NoteEditMenuContent>
            <NoteEditMenuSub edits={TIME_EDITS} label="Time" />
            <NoteEditMenuSub edits={PITCH_EDITS} label="Pitch" />
            <NoteEditMenuSub edits={VELOCITY_EDITS} label="Velocity" />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={reset}>Reset</DropdownMenuItem>
          </NoteEditMenuContent>
        </NoteEditMenu>
      </div>
      <Timeline duration={BOUNDS.duration} snapStep={1}>
        <PianoRoll
          className="h-72 rounded-md border"
          maxPitch={BOUNDS.maxPitch}
          minPitch={BOUNDS.minPitch}
          onSelectionChange={setSelection}
          onValueChange={setNotes}
          selection={selection}
          value={notes}
        >
          <PianoRollViewport>
            <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
              <PianoRollGrid accentStep={4} aria-label="Notes" gridStep={1} />
            </PianoRollStrip>
            <PianoRollStrip
              className="border-t"
              lead={<PianoRollVelocityScale />}
              sticky="bottom"
            >
              <PianoRollVelocity accentStep={4} gridStep={1} />
            </PianoRollStrip>
          </PianoRollViewport>
        </PianoRoll>
      </Timeline>
    </div>
  );
}
