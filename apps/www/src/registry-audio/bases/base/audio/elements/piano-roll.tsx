"use client";

import {
  PianoRoll as PianoRollPrimitive,
  Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
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

/** Velocities the scale beside the velocity lane labels, in MIDI's 1…127. */
const VELOCITY_MARKS = [127, 64, 1];

type PianoRollProps = Omit<PianoRollPrimitive.Root.Props, "className"> & {
  className?: string;
};

/**
 * The editor's frame. What it holds lines up on two columns: the keys' on
 * the left, the timeline's beside it. Give it a height; its viewport takes
 * what is left. Sits inside a `Timeline`.
 */
function PianoRoll({ className, ...props }: PianoRollProps) {
  return (
    <PianoRollPrimitive.Root
      className={cn(
        "cn-piano-roll group/piano-roll flex min-h-0 w-full min-w-0 flex-col overflow-hidden [--piano-roll-keys-width:3.5rem] data-disabled:opacity-50",
        className
      )}
      data-slot="piano-roll"
      {...props}
    />
  );
}

/** Scrolls the roll both ways, without scrollbars: put a `TimelineNavigator` above it to scroll and zoom across. */
function PianoRollViewport({
  children,
  className,
  ...props
}: TimelinePrimitive.Viewport.Props) {
  return (
    <TimelinePrimitive.Viewport
      className={cn(
        "relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-slot="piano-roll-viewport"
      {...props}
    >
      {/* As wide as the lanes, so the sticky keys stay put however far it scrolls. */}
      <div className="flex min-h-full w-max min-w-full flex-col">
        {children}
      </div>
    </TimelinePrimitive.Viewport>
  );
}

type PianoRollStripProps = ComponentProps<"div"> & {
  /** What sits in the keys' column, stuck to the left edge as the roll scrolls. */
  lead?: ReactNode;
  /** Keeps the strip at the top or the bottom of the viewport. */
  sticky?: "bottom" | "top";
};

/** A row of the editor: `lead` in the keys' column, the lanes in `children` beside it. */
function PianoRollStrip({
  children,
  className,
  lead,
  sticky,
  ...props
}: PianoRollStripProps) {
  return (
    <div
      className={cn(
        "flex min-w-full",
        sticky === "top" && "sticky top-0 z-30",
        sticky === "bottom" && "sticky bottom-0 z-30 mt-auto",
        className
      )}
      data-slot="piano-roll-strip"
      {...props}
    >
      <div className="sticky left-0 z-20 flex w-(--piano-roll-keys-width) shrink-0 flex-col border-e bg-background">
        {lead}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

type PianoRollKeysProps = Omit<PianoRollPrimitive.Keys.Props, "className"> &
  VariantProps<typeof pianoRollVariants> & { className?: string };

/** The keyboard down the side, one key per row: press one to hear it, Shift selects its row. */
function PianoRollKeys({ className, size, ...props }: PianoRollKeysProps) {
  return (
    <PianoRollPrimitive.Keys
      aria-label="Keys"
      className={cn(
        "cn-piano-roll-keys flex-1 touch-none select-none",
        pianoRollVariants({ size }),
        className
      )}
      data-slot="piano-roll-keys"
      {...props}
    >
      <PianoRollPrimitive.Rows>
        {(pitch) => (
          <PianoRollPrimitive.Key
            className="cn-piano-roll-key inset-x-0 flex cursor-pointer items-center justify-end pe-1.5 text-[10px] outline-none"
            key={pitch}
            pitch={pitch}
          >
            {/* Only C, where octaves are counted from; folded, rows are not neighbours and each names itself. */}
            <PianoRollPrimitive.KeyLabel
              className={cn(
                pitch % 12 !== 0 && "hidden group-data-folded/piano-roll:inline"
              )}
            />
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
    /** A firmer line every `accentStep` units, such as each beat. */
    accentStep?: number;
    className?: string;
    /** Distance between grid lines, in the timeline's units. Leave it out for no lines. */
    gridStep?: number;
    style?: CSSProperties;
  };

/** Lines every `gridStep` units, firmer every `accentStep`, sized from the grid's own unit so they follow the zoom. */
function gridLines(
  gridStep: number | undefined,
  accentStep: number | undefined
): CSSProperties | undefined {
  const layers = [
    { color: "var(--timeline-grid-accent-color)", step: accentStep },
    { color: "var(--timeline-grid-color)", step: gridStep },
  ].filter(({ step }) => step !== undefined && step > 0);
  if (layers.length === 0) {
    return;
  }
  return {
    backgroundImage: layers
      .map(
        ({ color }) =>
          `repeating-linear-gradient(to right, ${color} 0 1px, transparent 1px 100%)`
      )
      .join(", "),
    backgroundSize: layers
      .map(({ step }) => `calc(var(--timeline-unit) * ${step}) 100%`)
      .join(", "),
  };
}

/** The notes, on their rows. Anything placed on the timeline, such as a `TimelinePlayhead`, goes in `children`. */
function PianoRollGrid({
  accentStep,
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
        "cn-piano-roll-grid flex-1 touch-none select-none outline-none data-[mode=draw]:cursor-cell",
        pianoRollVariants({ size }),
        className
      )}
      data-slot="piano-roll-grid"
      style={{ ...gridLines(gridStep, accentStep), ...style }}
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
            className="cn-piano-roll-note cursor-grab touch-none select-none border border-primary bg-[color-mix(in_oklab,var(--primary)_calc(30%_+_var(--piano-roll-velocity)_*_60%),transparent)] outline-none active:cursor-grabbing data-selected:border-foreground"
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
      <PianoRollPrimitive.Marquee className="cn-piano-roll-marquee z-10" />
      {children}
    </PianoRollPrimitive.Grid>
  );
}

type PianoRollVelocityProps = Omit<
  PianoRollPrimitive.VelocityLane.Props,
  "className"
> & { className?: string };

/** Each note's velocity as a bar: drag one up or down, or use the arrow keys. */
function PianoRollVelocity({ className, ...props }: PianoRollVelocityProps) {
  return (
    <PianoRollPrimitive.VelocityLane
      aria-label="Velocity"
      className={cn(
        "cn-piano-roll-velocity h-14 touch-none select-none",
        className
      )}
      data-slot="piano-roll-velocity"
      {...props}
    >
      <PianoRollPrimitive.Notes>
        {(note) => (
          <PianoRollPrimitive.Velocity
            className="cn-piano-roll-velocity-bar w-1.5 cursor-ns-resize after:absolute after:-inset-x-1 after:inset-y-0"
            key={note.id}
            note={note}
          />
        )}
      </PianoRollPrimitive.Notes>
    </PianoRollPrimitive.VelocityLane>
  );
}

/** The scale beside the velocity lane, for the `lead` of its strip. */
function PianoRollVelocityScale({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative my-1.5 flex-1 text-[10px] text-muted-foreground tabular-nums leading-none",
        className
      )}
      data-slot="piano-roll-velocity-scale"
      {...props}
    >
      {VELOCITY_MARKS.map((mark) => (
        <span
          className="absolute end-1.5 flex translate-y-1/2 items-center gap-1"
          key={mark}
          style={{ bottom: `${(mark / 127) * 100}%` }}
        >
          {mark}
          <span className="h-px w-1 bg-muted-foreground" />
        </span>
      ))}
    </div>
  );
}

export {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollVelocity,
  PianoRollVelocityScale,
  PianoRollViewport,
};
