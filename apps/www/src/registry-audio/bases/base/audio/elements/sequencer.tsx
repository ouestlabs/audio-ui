"use client";

import { Sequencer as SequencerPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

type SequencerProps = Omit<SequencerPrimitive.Root.Props, "className"> & {
  className?: string;
  /** Names each row, such as "Kick": it labels the row for assistive technology and is written beside it. */
  rowLabels?: readonly string[];
  /** Highlights every `beatEvery` steps, such as 4 for a beat in sixteenths. */
  beatEvery?: number;
  /** Draws a bar under each row to set how loud every step plays: press or drag across it; Alt + click returns a step to full. */
  showVelocity?: boolean;
};

/**
 * A step sequencer: a row of steps per sound. Press a step to flip it and
 * drag on to paint the same state across the others; the arrow keys move
 * between steps and Space flips one. Pass `source` with the step being played
 * and its column lights up. With `showVelocity`, a bar under each row sets
 * how loud each step plays; pass `velocities` and `onVelocityChange` to follow
 * them.
 */
function Sequencer({
  beatEvery = 4,
  className,
  rowLabels,
  showVelocity = false,
  ...props
}: SequencerProps) {
  return (
    <SequencerPrimitive.Root
      className={cn(
        "cn-sequencer w-full min-w-0 select-none data-disabled:opacity-50",
        // Labelled rows share one label column, as wide as the longest label.
        rowLabels
          ? "grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5"
          : "flex flex-col gap-1.5",
        className
      )}
      data-slot="sequencer"
      {...props}
    >
      <SequencerPrimitive.Rows>
        {(row) => (
          <SequencerPrimitive.Row
            aria-label={rowLabels?.[row] ?? `Row ${row + 1}`}
            className={
              rowLabels
                ? "col-span-2 grid grid-cols-subgrid items-center"
                : "flex items-center"
            }
            index={row}
          >
            {rowLabels ? (
              <span
                aria-hidden="true"
                className="max-w-24 truncate text-muted-foreground text-xs"
              >
                {rowLabels[row]}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="grid grid-flow-col auto-cols-fr gap-1">
                <SequencerPrimitive.Cells>
                  {(step) => (
                    <SequencerPrimitive.Cell
                      aria-label={`${rowLabels?.[row] ?? `Row ${row + 1}`}, step ${step + 1}`}
                      className={cn(
                        "cn-sequencer-cell h-9 min-w-0 cursor-pointer touch-none outline-none",
                        step % beatEvery === 0 && "cn-sequencer-cell-beat"
                      )}
                      step={step}
                    />
                  )}
                </SequencerPrimitive.Cells>
              </div>
              {showVelocity ? (
                <div className="grid grid-flow-col auto-cols-fr gap-1">
                  <SequencerPrimitive.Cells>
                    {(step) => (
                      <SequencerPrimitive.Velocity
                        aria-label={`${rowLabels?.[row] ?? `Row ${row + 1}`}, step ${step + 1} velocity`}
                        className="cn-sequencer-velocity relative h-8 min-w-0 cursor-ns-resize touch-none outline-none"
                        step={step}
                      >
                        <span className="cn-sequencer-velocity-fill absolute inset-x-0 bottom-0 h-[calc(var(--sequencer-velocity)*100%)]" />
                      </SequencerPrimitive.Velocity>
                    )}
                  </SequencerPrimitive.Cells>
                </div>
              ) : null}
            </div>
          </SequencerPrimitive.Row>
        )}
      </SequencerPrimitive.Rows>
    </SequencerPrimitive.Root>
  );
}

export { Sequencer };
