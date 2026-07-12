"use client";

import { PianoRoll as PianoRollPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

/** Mirrors the primitive's own default step count, used only to size the decorative grid lines when neither value nor defaultValue is passed. */
const DEFAULT_TOTAL_STEPS = 16;

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

interface PianoRollProps
  extends PianoRollPrimitive.RootProps,
    VariantProps<typeof pianoRollVariants> {
  /** Shows the playhead part. Position updates far too fast for React state — drive it via `playheadRef`. */
  isPlaying?: boolean;
  playheadRef?: React.RefObject<HTMLDivElement | null>;
}

export function PianoRoll({
  className,
  size,
  isPlaying,
  playheadRef,
  totalSteps = DEFAULT_TOTAL_STEPS,
  ...props
}: PianoRollProps) {
  return (
    <PianoRollPrimitive.Root
      className="flex w-full min-w-0 gap-2 data-[disabled=true]:cursor-not-allowed"
      totalSteps={totalSteps}
      {...props}
    >
      <PianoRollPrimitive.KeysTrack
        className={cn(
          "cn-piano-roll-keys relative w-10 shrink-0 touch-none select-none overflow-hidden",
          pianoRollVariants({ size })
        )}
      >
        <PianoRollPrimitive.Keys>
          {(note) => (
            <PianoRollPrimitive.Key
              className="cn-piano-roll-key"
              key={note}
              note={note}
            />
          )}
        </PianoRollPrimitive.Keys>
      </PianoRollPrimitive.KeysTrack>
      <PianoRollPrimitive.Grid
        className={cn(
          "cn-piano-roll relative min-w-0 flex-1 touch-none select-none overflow-hidden",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
          pianoRollVariants({ size }),
          className
        )}
        data-slot="piano-roll"
      >
        {Array.from({ length: totalSteps - 1 }, (_, i) => (
          <div
            className="cn-piano-roll-line absolute inset-y-0 w-px"
            key={String(i)}
            style={{ left: `${((i + 1) / totalSteps) * 100}%` }}
          />
        ))}
        <PianoRollPrimitive.Notes>
          {(note) => (
            <PianoRollPrimitive.Note
              className="cn-piano-roll-note cursor-grab touch-none select-none outline-none active:cursor-grabbing"
              id={note.id}
              key={note.id}
            >
              <PianoRollPrimitive.NoteHandle
                className="cn-piano-roll-note-handle inset-y-0 left-0 w-1.5 cursor-ew-resize"
                side="start"
              />
              <PianoRollPrimitive.NoteHandle
                className="cn-piano-roll-note-handle inset-y-0 right-0 w-1.5 cursor-ew-resize"
                side="end"
              />
            </PianoRollPrimitive.Note>
          )}
        </PianoRollPrimitive.Notes>
        {isPlaying ? (
          <PianoRollPrimitive.Playhead
            className="cn-piano-roll-playhead inset-y-0 w-px"
            ref={playheadRef}
          />
        ) : null}
      </PianoRollPrimitive.Grid>
    </PianoRollPrimitive.Root>
  );
}
