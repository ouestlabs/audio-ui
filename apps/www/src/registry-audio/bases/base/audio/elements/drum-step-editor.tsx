import type { Note } from "@audio-ui/core/piano-roll";
import type { Source } from "@audio-ui/react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";
import {
  filledEvery,
  MAX_REPEATS,
  type StepGrid,
  stepsOf,
  withStep,
  withStepRepeats,
} from "@/registry-audio/bases/base/lib/drum-steps";

/** A pad of the drum rack that plays the clip: the note it answers and its name. */
export interface DrumStepPad {
  name: string;
  note: number;
}

/** How often a row can be filled, in steps. */
const FILLS = [2, 4, 8] as const;

/** The narrowest a step is drawn, so a long clip scrolls rather than squeezing its steps. */
const STEP_REM = 1.5;
/** How much of the view's end the fade takes: a step in it is not yet in view. */
const FADE_PX = 40;

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
  /** The step being played, a live value: its column lights up. */
  source?: Source<number>;
  /** Where the first step starts, in the clip's source: its loop's start. @default 0 */
  start?: number;
  /** How long a step lasts, in seconds. */
  step: number;
  /** How many steps the grid has. */
  steps: number;
}

/**
 * A drum clip's notes as steps, a row per pad of the drum rack that plays
 * them: press a step to switch it, and drag across to paint. With Repeat on,
 * a press on a step that plays makes it a roll, two, three or four hits, and
 * back to one. A step is drawn fainter the softer it plays, so a ghost note
 * shows as one, and while the clip plays, the view keeps the step being played
 * in sight. The notes stay what the clip keeps, so a note off the grid still
 * lights its step, and the piano roll shows the same notes, with their
 * velocity and chance. A pad's name sounds it, and its menu fills the row
 * every 2, 4 or 8 steps, or clears it.
 */
function DrumStepEditor({
  beatEvery = 4,
  className,
  notes,
  onAudition,
  onNotesChange,
  onNotesCommitted,
  pads,
  source,
  start = 0,
  step,
  steps,
}: DrumStepEditorProps) {
  const grid = useMemo<StepGrid>(
    () => ({ notes: pads.map((pad) => pad.note), start, step, steps }),
    [pads, start, step, steps]
  );
  const view = useMemo(() => stepsOf(notes, grid), [grid, notes]);
  const [repeating, setRepeating] = useState(false);
  const toggleRepeating = useCallback(() => setRepeating((on) => !on), []);

  // A step that changed is a note added or taken away, the rest left as they are; with Repeat on, a step that plays turns into its next roll instead of off.
  const changePattern = useCallback(
    (next: boolean[][]) => {
      let changed: readonly Note[] = notes;
      next.forEach((row, at) => {
        row.forEach((on, index) => {
          if (on === Boolean(view.pattern[at]?.[index])) {
            return;
          }
          const cell = { row: at, step: index };
          if (repeating && !on) {
            const times = view.repeats[at]?.[index] ?? 1;
            changed = withStepRepeats(
              changed,
              grid,
              cell,
              times >= MAX_REPEATS ? 1 : times + 1
            );
          } else {
            changed = withStep(changed, grid, cell, on);
          }
        });
      });
      if (changed !== notes) {
        onNotesChange([...changed]);
      }
    },
    [grid, notes, onNotesChange, repeating, view.pattern, view.repeats]
  );
  const renderCell = useCallback(
    (row: number, index: number) => {
      const times = view.repeats[row]?.[index] ?? 0;
      return times > 1 ? `×${times}` : null;
    },
    [view.repeats]
  );

  // While the clip plays, the step being played stays in sight: past the view, it turns the page.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!source) {
      return;
    }
    let last = -1;
    const follow = () => {
      const now = Math.floor(source.getSnapshot());
      if (now === last) {
        return;
      }
      last = now;
      const scroller = scrollerRef.current;
      const cell = scroller?.querySelector<HTMLElement>(`[data-step="${now}"]`);
      if (!(scroller && cell)) {
        return;
      }
      const label = scroller.querySelector<HTMLElement>(
        '[data-slot="drum-step-label"]'
      );
      const box = scroller.getBoundingClientRect();
      const at = cell.getBoundingClientRect();
      const from = box.left + (label?.offsetWidth ?? 0) + 8;
      if (at.left < from || at.right > box.right - FADE_PX) {
        scroller.scrollBy({ behavior: "smooth", left: at.left - from });
      }
    };
    return source.subscribe(follow);
  }, [source]);
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
        // Its background reaches over the gaps around it too, so no step shows between the names as the steps scroll under them, and fades out across the gap before the steps, which leaves the ring of the step being played whole.
        <div
          className="sticky start-1 z-10 flex w-28 min-w-0 items-center gap-0.5 self-stretch bg-card before:pointer-events-none before:absolute before:-inset-y-1 before:-start-1 before:-end-2 before:-z-10 before:bg-[linear-gradient(to_right,var(--color-card)_calc(100%-0.5rem),transparent)]"
          data-slot="drum-step-label"
        >
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
              <IconPlaceholder
                aria-hidden="true"
                className="size-3"
                hugeicons="MoreHorizontalIcon"
                lucide="EllipsisIcon"
                phosphor="DotsThreeIcon"
                remixicon="RiMoreLine"
                tabler="IconDots"
              />
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
      <div className="flex items-center gap-2">
        <Button
          aria-pressed={repeating}
          className="h-6 px-2 text-xs"
          onClick={toggleRepeating}
          size="xs"
          variant={repeating ? "default" : "outline"}
        >
          Repeat
        </Button>
        {repeating ? (
          <span className="truncate text-[10px] text-muted-foreground">
            Press a step that plays to roll it: twice, three times, four, then
            once again.
          </span>
        ) : null}
      </div>
      {/* Each axis scrolls in a box of its own, so each fades at its own edges: the pads down, the steps across, under the pads' names, which stay. */}
      <div className="no-scrollbar scroll-fade min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className="no-scrollbar scroll-fade-e overflow-x-auto overflow-y-hidden"
          ref={scrollerRef}
        >
          <Sequencer
            beatEvery={beatEvery}
            // Every pad on screen at once: short steps, with room around them for the ring of the step being played.
            className="gap-y-1 p-1"
            onValueChange={changePattern}
            onValueCommitted={commit}
            renderCell={renderCell}
            renderRowLabel={renderRowLabel}
            rowLabels={pads.map((pad) => pad.name)}
            shadeByVelocity
            size="sm"
            source={source}
            style={{ minWidth: `${steps * STEP_REM + 8}rem` }}
            value={view.pattern}
            velocities={view.velocities}
          />
        </div>
      </div>
    </div>
  );
}

export { DrumStepEditor, type DrumStepEditorProps };
