"use client";

import { PianoRoll as PianoRollPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const pianoRollVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-piano-roll-size-default",
      lg: "cn-piano-roll-size-lg",
      sm: "cn-piano-roll-size-sm",
    },
  },
});

type PianoRollProps = Omit<PianoRollPrimitive.Root.Props, "className"> & {
  className?: string;
};

/**
 * Two columns: the keys, then the grid. Put a `TimelineRuler` or any other
 * lane in the second column with `col-start-2`, and it lines up with the
 * grid. Sits inside a `Timeline`.
 */
function PianoRoll({ className, ...props }: PianoRollProps) {
  return (
    <PianoRollPrimitive.Root
      className={cn(
        "grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 data-disabled:opacity-50",
        className
      )}
      data-slot="piano-roll"
      {...props}
    />
  );
}

type PianoRollKeysProps = Omit<PianoRollPrimitive.Keys.Props, "className"> &
  VariantProps<typeof pianoRollVariants> & { className?: string };

function PianoRollKeys({ className, size, ...props }: PianoRollKeysProps) {
  return (
    <PianoRollPrimitive.Keys
      aria-label="Keys"
      className={cn(
        "cn-piano-roll-keys col-start-1 touch-none select-none overflow-hidden",
        pianoRollVariants({ size }),
        className
      )}
      data-slot="piano-roll-keys"
      {...props}
    >
      <PianoRollPrimitive.Rows>
        {(pitch) => (
          <PianoRollPrimitive.Key
            className="cn-piano-roll-key inset-x-0 flex cursor-pointer items-center justify-end pe-2 text-[10px] text-muted-foreground outline-none data-active:text-primary-foreground"
            key={pitch}
            pitch={pitch}
          >
            {pitch % 12 === 0 ? <PianoRollPrimitive.KeyLabel /> : null}
          </PianoRollPrimitive.Key>
        )}
      </PianoRollPrimitive.Rows>
    </PianoRollPrimitive.Keys>
  );
}

type PianoRollGridProps = Omit<
  PianoRollPrimitive.Grid.Props,
  "className" | "style"
> &
  VariantProps<typeof pianoRollVariants> & {
    className?: string;
    /** Distance between grid lines, in the timeline's units. Leave it out for no lines. */
    gridStep?: number;
    style?: CSSProperties;
  };

/** A line every `gridStep` units, sized from the grid's own unit so it follows the zoom. */
function gridLines(gridStep: number | undefined): CSSProperties | undefined {
  if (!(gridStep && gridStep > 0)) {
    return;
  }
  return {
    backgroundImage:
      "repeating-linear-gradient(to right, var(--timeline-grid-color) 0 1px, transparent 1px 100%)",
    backgroundSize: `calc(var(--timeline-unit) * ${gridStep}) 100%`,
  };
}

/** The notes, on their rows. Anything placed on the timeline, such as a `TimelinePlayhead`, goes in `children`. */
function PianoRollGrid({
  children,
  className,
  gridStep,
  size,
  style,
  ...props
}: PianoRollGridProps) {
  return (
    <PianoRollPrimitive.Grid
      className={cn(
        "cn-piano-roll col-start-2 touch-none select-none overflow-hidden outline-none",
        "data-[mode=draw]:cursor-cell",
        pianoRollVariants({ size }),
        className
      )}
      data-slot="piano-roll-grid"
      style={{ ...gridLines(gridStep), ...style }}
      {...props}
    >
      <PianoRollPrimitive.Rows>
        {(pitch) => (
          <PianoRollPrimitive.Row
            className="cn-piano-roll-row"
            key={pitch}
            pitch={pitch}
          />
        )}
      </PianoRollPrimitive.Rows>
      <PianoRollPrimitive.Notes>
        {(note) => (
          <PianoRollPrimitive.Note
            className="cn-piano-roll-note cursor-grab touch-none select-none outline-none [opacity:calc(0.45+0.55*var(--piano-roll-velocity))] active:cursor-grabbing"
            key={note.id}
            note={note}
          >
            <PianoRollPrimitive.NoteHandle
              className="cn-piano-roll-note-handle absolute inset-y-0 w-[min(0.375rem,25%)] cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
              edge="start"
            />
            <PianoRollPrimitive.NoteHandle
              className="cn-piano-roll-note-handle absolute inset-y-0 w-[min(0.375rem,25%)] cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
              edge="end"
            />
          </PianoRollPrimitive.Note>
        )}
      </PianoRollPrimitive.Notes>
      <PianoRollPrimitive.Marquee className="cn-piano-roll-marquee" />
      {children}
    </PianoRollPrimitive.Grid>
  );
}

export { PianoRoll, PianoRollGrid, PianoRollKeys };
