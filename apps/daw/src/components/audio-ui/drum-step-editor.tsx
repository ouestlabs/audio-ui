"use client";

import type { Note } from "@audio-ui/core/piano-roll";
import { type MouseEvent, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sequencer } from "@/components/audio-ui/sequencer";
import {
  filledEvery,
  type StepGrid,
  stepsOf,
  withStep,
} from "@/lib/drum-steps";
import { DotsThreeIcon } from "@phosphor-icons/react";

/** A pad of the drum rack that plays the clip: the note it answers and its name. */
export interface DrumStepPad {
  name: string;
  note: number;
}

/** How often a row can be filled, in steps. */
const FILLS = [2, 4, 8] as const;

/** The narrowest a step is drawn, so a long clip scrolls rather than squeezing its steps. */
const STEP_REM = 1.5;

interface DrumStepEditorProps {
  /** How many steps make a beat: a firmer step marks each. @default 4 */
  beatEvery?: number;
  className?: string;
  /** The clip's notes, in seconds from the start of its source. */
  notes: readonly Note[];
  /** A pad's name was pressed: sound it. */
  onAudition?: (note: number) => void;
  /** Fires on every change of the notes, as a paint or a drag goes. */
  onNotesChange: (notes: Note[]) => void;
  /** Fires once a change ends: the place to take an undo step. */
  onNotesCommitted?: () => void;
  /** The pads, top to bottom: a row each. */
  pads: readonly DrumStepPad[];
  /** Where the first step starts, in the clip's source: its loop's start. @default 0 */
  start?: number;
  /** How long a step lasts, in seconds. */
  step: number;
  /** How many steps the grid has. */
  steps: number;
}

/**
 * A drum clip's notes as steps, a row per pad of the drum rack that plays
 * them: press a step to switch it, and drag across to paint. The notes stay
 * what the clip keeps, so a note off the grid still lights its step, and the
 * piano roll shows the same notes, with their velocity and chance. A pad's
 * name sounds it, and its menu fills the row every 2, 4 or 8 steps, or clears
 * it.
 */
function DrumStepEditor({
  beatEvery = 4,
  className,
  notes,
  onAudition,
  onNotesChange,
  onNotesCommitted,
  pads,
  start = 0,
  step,
  steps,
}: DrumStepEditorProps) {
  const grid = useMemo<StepGrid>(
    () => ({ notes: pads.map((pad) => pad.note), start, step, steps }),
    [pads, start, step, steps]
  );
  const view = useMemo(() => stepsOf(notes, grid), [grid, notes]);

  // A step that changed is a note added or taken away: the rest stay as they are.
  const changePattern = useCallback(
    (next: boolean[][]) => {
      let changed: readonly Note[] = notes;
      next.forEach((row, at) => {
        row.forEach((on, index) => {
          if (on !== Boolean(view.pattern[at]?.[index])) {
            changed = withStep(changed, grid, { row: at, step: index }, on);
          }
        });
      });
      if (changed !== notes) {
        onNotesChange([...changed]);
      }
    },
    [grid, notes, onNotesChange, view.pattern]
  );
  const commit = useCallback(() => onNotesCommitted?.(), [onNotesCommitted]);
  const audition = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      onAudition?.(Number(event.currentTarget.dataset.note)),
    [onAudition]
  );
  const fill = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const { every, row } = event.currentTarget.dataset;
      onNotesChange([...filledEvery(notes, grid, Number(row), Number(every))]);
      onNotesCommitted?.();
    },
    [grid, notes, onNotesChange, onNotesCommitted]
  );
  const clear = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const pitch = pads[Number(event.currentTarget.dataset.row)]?.note;
      onNotesChange(
        notes.filter(
          (note) =>
            note.pitch !== pitch ||
            note.start < start ||
            note.start >= start + steps * step
        )
      );
      onNotesCommitted?.();
    },
    [notes, onNotesChange, onNotesCommitted, pads, start, step, steps]
  );

  const renderRowLabel = useCallback(
    (row: number) => {
      const pad = pads[row];
      if (!pad) {
        return null;
      }
      return (
        <div className="flex w-28 min-w-0 items-center gap-0.5">
          <Button
            className="h-6 min-w-0 flex-1 justify-start truncate px-1.5 text-xs"
            data-note={pad.note}
            onClick={audition}
            size="xs"
            title={`Sound ${pad.name}`}
            variant="ghost"
          >
            {pad.name}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`${pad.name} steps`}
                  className="size-6 shrink-0"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <DotsThreeIcon aria-hidden="true" className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto">
              {FILLS.map((every) => (
                <DropdownMenuItem
                  data-every={every}
                  data-row={row}
                  key={every}
                  onClick={fill}
                >
                  Fill every {every} steps
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-row={row}
                onClick={clear}
                variant="destructive"
              >
                Clear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    [audition, clear, fill, pads]
  );

  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-col gap-2 p-2", className)}
      data-slot="drum-step-editor"
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Sequencer
          beatEvery={beatEvery}
          // Every pad on screen at once: short steps.
          className="gap-y-1"
          onValueChange={changePattern}
          onValueCommitted={commit}
          renderRowLabel={renderRowLabel}
          rowLabels={pads.map((pad) => pad.name)}
          size="sm"
          style={{ minWidth: `${steps * STEP_REM + 8}rem` }}
          value={view.pattern}
          velocities={view.velocities}
        />
      </div>
    </div>
  );
}

export { DrumStepEditor, type DrumStepEditorProps };