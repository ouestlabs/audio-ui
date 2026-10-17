"use client";

import {
  PianoRoll as PianoRollPrimitive,
  Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

/**
 * The velocities the scale beside the velocity lane labels, in MIDI's 1…127:
 * every 16 when the lane is tall enough, else every 32 or 64, and only the
 * ends when it is short. Labels stay about 13px apart, so they never touch.
 */
function velocityMarks(height: number): number[] {
  const step = [16, 32, 64].find((every) => (height * every) / 127 >= 13);
  if (!step) {
    return [127, 1];
  }
  const marks = [127];
  for (let mark = Math.floor(126 / step) * step; mark >= step; mark -= step) {
    marks.push(mark);
  }
  marks.push(1);
  return marks;
}
/** How tall the velocity lane can be dragged, in px, and how far an arrow key moves it. */
const VELOCITY_HEIGHT = { default: 56, keyStep: 8, max: 240, min: 32 };

/**
 * The tallest the lane can get: half the room it shares with the notes in the
 * viewport, below a strip stuck to the top, so the notes keep the other half.
 */
function tallestLane(element: HTMLElement): number {
  const strip = element.closest<HTMLElement>('[data-slot="piano-roll-strip"]');
  const viewport = element.closest<HTMLElement>(
    '[data-slot="piano-roll-viewport"]'
  );
  if (!(strip && viewport)) {
    return VELOCITY_HEIGHT.max;
  }
  const first = viewport.querySelector<HTMLElement>(
    '[data-slot="piano-roll-strip"]'
  );
  const above =
    first && first !== strip && getComputedStyle(first).position === "sticky"
      ? first.offsetHeight
      : 0;
  return Math.max(
    VELOCITY_HEIGHT.min,
    Math.min(VELOCITY_HEIGHT.max, (viewport.clientHeight - above) / 2)
  );
}

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
        "relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-slot="piano-roll-viewport"
      {...props}
    >
      {/* As wide as the lanes, so the sticky keys stay put however far it scrolls. */}
      <div className="flex min-h-full w-max min-w-full shrink-0 grow flex-col">
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
      <PianoRollSelectionSpan />
      <PianoRollPrimitive.Notes>
        {(note) => (
          <PianoRollPrimitive.Note
            className="cn-piano-roll-note cursor-grab touch-none select-none border border-primary bg-[color-mix(in_oklab,var(--primary)_calc(30%_+_var(--piano-roll-velocity)_*_60%),transparent)] opacity-[calc(0.4+var(--piano-roll-chance)*0.6)] outline-none active:cursor-grabbing data-muted:border-muted-foreground data-muted:bg-muted data-[selected]:border-foreground data-[selected]:bg-primary data-[selected]:ring-1 data-[selected]:ring-foreground data-muted:data-[selected]:bg-muted-foreground/40"
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
  "className" | "style"
> & {
  /** A firmer line every `accentStep` units, as on the grid above. */
  accentStep?: number;
  className?: string;
  /** Distance between lines, in the timeline's units: give it the grid's, so each bar lines up with its note. */
  gridStep?: number;
  style?: CSSProperties;
};

/**
 * Each note's velocity as a bar: drag one up or down, or use the arrow keys.
 * Its top edge drags the lane taller or shorter, as do Up and Down on it.
 */
function PianoRollVelocity({
  accentStep,
  children,
  className,
  gridStep,
  style,
  ...props
}: PianoRollVelocityProps) {
  const [height, setHeight] = useState(VELOCITY_HEIGHT.default);
  const [tallest, setTallest] = useState(VELOCITY_HEIGHT.max);
  const dragRef = useRef<{ height: number; y: number } | null>(null);
  const resize = useCallback((element: HTMLElement, next: number) => {
    const max = tallestLane(element);
    setTallest(max);
    setHeight(Math.round(Math.min(max, Math.max(VELOCITY_HEIGHT.min, next))));
  }, []);
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { height, y: event.clientY };
    },
    [height]
  );
  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag) {
        resize(event.currentTarget, drag.height + drag.y - event.clientY);
      }
    },
    [resize]
  );
  const handleLostPointerCapture = useCallback(() => {
    dragRef.current = null;
  }, []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const direction = { ArrowDown: -1, ArrowUp: 1 }[event.key];
      if (direction) {
        event.preventDefault();
        resize(
          event.currentTarget,
          height + direction * VELOCITY_HEIGHT.keyStep
        );
      }
    },
    [height, resize]
  );
  return (
    <PianoRollPrimitive.VelocityLane
      aria-label="Velocity"
      className={cn("cn-piano-roll-velocity touch-none select-none", className)}
      data-slot="piano-roll-velocity"
      style={{ ...gridLines(gridStep, accentStep), height, ...style }}
      {...props}
    >
      <div
        aria-label="Velocity lane height"
        aria-orientation="horizontal"
        aria-valuemax={Math.round(tallest)}
        aria-valuemin={VELOCITY_HEIGHT.min}
        aria-valuenow={height}
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-ns-resize outline-none transition-colors hover:bg-primary/30 focus-visible:bg-ring/50"
        data-slot="piano-roll-velocity-resize"
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        role="separator"
        tabIndex={0}
      />
      <PianoRollSelectionSpan />
      <PianoRollPrimitive.Notes>
        {(note) => (
          <PianoRollPrimitive.Velocity
            className="cn-piano-roll-velocity-bar w-1.5 cursor-ns-resize after:absolute after:-inset-x-1 after:inset-y-0"
            key={note.id}
            note={note}
          />
        )}
      </PianoRollPrimitive.Notes>
      {children}
    </PianoRollPrimitive.VelocityLane>
  );
}

/** The time the selected notes cover, shaded down the grid, the velocity lane, or a ruler it is put in. */
function PianoRollSelectionSpan({
  className,
  ...props
}: Omit<PianoRollPrimitive.SelectionSpan.Props, "className"> & {
  className?: string;
}) {
  return (
    <PianoRollPrimitive.SelectionSpan
      className={cn("cn-piano-roll-selection", className)}
      data-slot="piano-roll-selection"
      {...props}
    />
  );
}

/** The scale beside the velocity lane, for the `lead` of its strip: it labels more velocities as the lane grows taller. */
function PianoRollVelocityScale({
  className,
  ...props
}: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry?.contentRect.height ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative my-1.5 flex-1 text-[10px] text-muted-foreground tabular-nums leading-none",
        className
      )}
      data-slot="piano-roll-velocity-scale"
      ref={ref}
      {...props}
    >
      {velocityMarks(height).map((mark) => (
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
  PianoRollSelectionSpan,
  PianoRollStrip,
  PianoRollVelocity,
  PianoRollVelocityScale,
  PianoRollViewport,
};
