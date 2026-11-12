import { Sequencer as SequencerPrimitive } from "@audio-ui/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SequencerProps = Omit<SequencerPrimitive.Root.Props, "className"> & {
  className?: string;
  /** Names each row, such as "Kick": it labels the row for assistive technology and is written beside it. */
  rowLabels?: readonly string[];
  /** What sits beside a row in place of its written name, such as a button that sounds it: the row keeps its name for assistive technology. */
  renderRowLabel?: (row: number) => ReactNode;
  /** Highlights every `beatEvery` steps, such as 4 for a beat in sixteenths. */
  beatEvery?: number;
  /** Draws a bar under each row to set how loud every step plays: press or drag across it; Alt + click returns a step to full. */
  showVelocity?: boolean;
  /** `sm` draws short steps and a thin bar under them, so many rows fit. @default "default" */
  size?: "default" | "sm";
  /** Draws a step that plays fainter the softer it plays, by `velocities`: a ghost note shows as one. @default false */
  shadeByVelocity?: boolean;
  /** What a step shows inside it, such as how many times it repeats. */
  renderCell?: (row: number, step: number) => ReactNode;
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
  renderCell,
  renderRowLabel,
  rowLabels,
  shadeByVelocity = false,
  showVelocity = false,
  size = "default",
  ...props
}: SequencerProps) {
  const { velocities } = props;
  return (
    <SequencerPrimitive.Root
      className={cn(
        "[--sequencer-off:var(--muted)] w-full min-w-0 select-none data-disabled:opacity-50",
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
            {renderRowLabel?.(row) ??
              (rowLabels ? (
                <span
                  aria-hidden="true"
                  className="max-w-24 truncate text-muted-foreground text-xs"
                >
                  {rowLabels[row]}
                </span>
              ) : null)}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="grid grid-flow-col auto-cols-fr gap-1">
                <SequencerPrimitive.Cells>
                  {(step) => (
                    <SequencerPrimitive.Cell
                      aria-label={`${rowLabels?.[row] ?? `Row ${row + 1}`}, step ${step + 1}`}
                      className={cn(
                        "rounded-[min(var(--radius-sm),6px)] border bg-muted/60 transition-[background-color,box-shadow,transform] duration-100 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 aria-pressed:border-primary aria-pressed:bg-primary data-current:ring-2 data-current:ring-foreground/40 data-disabled:pointer-events-none motion-reduce:transition-none motion-reduce:active:scale-100 flex min-w-0 cursor-pointer touch-none items-center justify-center font-medium text-[9px] tabular-nums outline-none aria-pressed:text-primary-foreground",
                        size === "sm" ? "h-6" : "h-9",
                        step % beatEvery === 0 && "bg-muted",
                        shadeByVelocity &&
                          "aria-pressed:opacity-(--sequencer-cell-level)"
                      )}
                      data-step={step}
                      step={step}
                      style={
                        shadeByVelocity
                          ? ({
                              "--sequencer-cell-level":
                                0.35 + 0.65 * (velocities?.[row]?.[step] ?? 1),
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      {renderCell?.(row, step)}
                    </SequencerPrimitive.Cell>
                  )}
                </SequencerPrimitive.Cells>
              </div>
              {showVelocity ? (
                <div className="grid grid-flow-col auto-cols-fr gap-1">
                  <SequencerPrimitive.Cells>
                    {(step) => (
                      <SequencerPrimitive.Velocity
                        aria-label={`${rowLabels?.[row] ?? `Row ${row + 1}`}, step ${step + 1} velocity`}
                        className={cn(
                          "overflow-hidden rounded-[min(var(--radius-sm),6px)] bg-muted/40 focus-within:ring-2 focus-within:ring-ring/50 data-disabled:pointer-events-none group/velocity relative min-w-0 cursor-ns-resize touch-none outline-none",
                          size === "sm" ? "h-3" : "h-8"
                        )}
                        step={step}
                      >
                        <span className="bg-primary/30 transition-[background-color] duration-100 ease-out motion-reduce:transition-none group-data-on/velocity:bg-primary absolute inset-x-0 bottom-0 h-[calc(var(--sequencer-velocity)*100%)]" />
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
