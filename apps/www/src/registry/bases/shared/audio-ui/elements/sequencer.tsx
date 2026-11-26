import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/registry/lib/utils";
import { Sequencer as SequencerPrimitive } from "@/registry/primitives/sequencer/react";

/**
 * How each part of the sequencer is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the sequencer's props: the React sequencer
 * applies these classes, and `registry:build` writes them as plain CSS on the
 * parts for every other framework. The root carries `data-size`, and
 * `data-labels` when its rows are named beside them, `data-shaded` when a
 * step plays fainter the softer it plays; a step on the beat carries
 * `data-beat`.
 */
export const sequencerParts = Object.freeze({
  // Labelled rows share one label column, as wide as the longest label.
  sequencer:
    "cn-sequencer flex w-full min-w-0 select-none flex-col gap-1.5 data-disabled:opacity-50 data-labels:grid data-labels:grid-cols-[auto_minmax(0,1fr)] data-labels:gap-x-2 data-labels:gap-y-1.5",
  "sequencer-row":
    "flex items-center in-data-labels:col-span-2 in-data-labels:grid in-data-labels:grid-cols-subgrid",
  "sequencer-row-label": "max-w-24 truncate text-muted-foreground text-xs",
  "sequencer-steps": "flex min-w-0 flex-1 flex-col gap-1",
  "sequencer-cells": "grid auto-cols-fr grid-flow-col gap-1",
  "sequencer-cell":
    "cn-sequencer-cell flex h-9 min-w-0 cursor-pointer touch-none items-center justify-center font-medium text-[9px] tabular-nums outline-none aria-pressed:text-primary-foreground in-data-[size=sm]:h-6 in-data-shaded:aria-pressed:opacity-(--sequencer-cell-level)",
  "sequencer-cell[data-beat]": "cn-sequencer-cell-beat",
  "sequencer-velocity":
    "cn-sequencer-velocity group/sequencer-velocity relative h-8 min-w-0 cursor-ns-resize touch-none outline-none in-data-[size=sm]:h-3",
  "sequencer-velocity-fill":
    "cn-sequencer-velocity-fill absolute inset-x-0 bottom-0 h-[calc(var(--sequencer-velocity)*100%)]",
});

/** The numbers 0 to length - 1, to make a part of each row or step from. */
const indexes = (length: number) => Array.from({ length }, (_, index) => index);

type SequencerProps = Omit<
  ComponentProps<typeof SequencerPrimitive.Root>,
  "children" | "className"
> & {
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
      className={cn(sequencerParts.sequencer, className)}
      data-labels={rowLabels ? "" : undefined}
      data-shaded={shadeByVelocity ? "" : undefined}
      data-size={size}
      data-slot="sequencer"
      {...props}
    >
      {({ rows, steps }) =>
        indexes(rows).map((row) => (
          <SequencerPrimitive.Row
            aria-label={rowLabels?.[row] ?? `Row ${row + 1}`}
            className={sequencerParts["sequencer-row"]}
            data-slot="sequencer-row"
            index={row}
            key={row}
          >
            {renderRowLabel?.(row) ??
              (rowLabels ? (
                <span
                  aria-hidden="true"
                  className={sequencerParts["sequencer-row-label"]}
                  data-slot="sequencer-row-label"
                >
                  {rowLabels[row]}
                </span>
              ) : null)}
            <div
              className={sequencerParts["sequencer-steps"]}
              data-slot="sequencer-steps"
            >
              <div
                className={sequencerParts["sequencer-cells"]}
                data-slot="sequencer-cells"
              >
                {indexes(steps).map((step) => (
                  <SequencerPrimitive.Cell
                    aria-label={`${rowLabels?.[row] ?? `Row ${row + 1}`}, step ${step + 1}`}
                    className={cn(
                      sequencerParts["sequencer-cell"],
                      step % beatEvery === 0 &&
                        sequencerParts["sequencer-cell[data-beat]"]
                    )}
                    data-beat={step % beatEvery === 0 ? "" : undefined}
                    data-slot="sequencer-cell"
                    data-step={step}
                    key={step}
                    row={row}
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
                ))}
              </div>
              {showVelocity ? (
                <div
                  className={sequencerParts["sequencer-cells"]}
                  data-slot="sequencer-cells"
                >
                  {indexes(steps).map((step) => (
                    <SequencerPrimitive.Velocity
                      aria-label={`${rowLabels?.[row] ?? `Row ${row + 1}`}, step ${step + 1} velocity`}
                      className={sequencerParts["sequencer-velocity"]}
                      data-slot="sequencer-velocity"
                      key={step}
                      row={row}
                      step={step}
                    >
                      <span
                        className={sequencerParts["sequencer-velocity-fill"]}
                        data-slot="sequencer-velocity-fill"
                      />
                    </SequencerPrimitive.Velocity>
                  ))}
                </div>
              ) : null}
            </div>
          </SequencerPrimitive.Row>
        ))
      }
    </SequencerPrimitive.Root>
  );
}

export { Sequencer };
