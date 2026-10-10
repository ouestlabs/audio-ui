"use client";

import { Sequencer as SequencerPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

type SequencerProps = Omit<SequencerPrimitive.Root.Props, "className"> & {
  className?: string;
  /** Names each row, such as "Kick": it labels the row for assistive technology and is written beside it. */
  rowLabels?: readonly string[];
  /** Highlights every `beatEvery` steps, such as 4 for a beat in sixteenths. */
  beatEvery?: number;
};

/**
 * A step sequencer: a row of steps per sound. Press a step to flip it and
 * drag on to paint the same state across the others; the arrow keys move
 * between steps and Space flips one. Pass `source` with the step being played
 * and its column lights up.
 */
function Sequencer({
  beatEvery = 4,
  className,
  rowLabels,
  ...props
}: SequencerProps) {
  return (
    <SequencerPrimitive.Root
      className={cn(
        "cn-sequencer flex w-full min-w-0 select-none flex-col gap-1.5 data-disabled:opacity-50",
        className
      )}
      data-slot="sequencer"
      {...props}
    >
      <SequencerPrimitive.Rows>
        {(row) => (
          <SequencerPrimitive.Row
            aria-label={rowLabels?.[row] ?? `Row ${row + 1}`}
            className="flex items-center gap-2"
            index={row}
          >
            {rowLabels ? (
              <span
                aria-hidden="true"
                className="w-12 shrink-0 text-muted-foreground text-xs"
              >
                {rowLabels[row]}
              </span>
            ) : null}
            <div className="grid min-w-0 flex-1 grid-flow-col auto-cols-fr gap-1">
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
          </SequencerPrimitive.Row>
        )}
      </SequencerPrimitive.Rows>
    </SequencerPrimitive.Root>
  );
}

export { Sequencer };
