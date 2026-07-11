"use client";

import { Sequencer as SequencerPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

/** Mirrors the primitive's own default step count, used only to keep the grid from collapsing when neither value nor defaultValue is passed. */
const DEFAULT_STEPS = 16;

const sequencerVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-sequencer-size-default",
      lg: "cn-sequencer-size-lg",
      sm: "cn-sequencer-size-sm",
    },
  },
});

interface SequencerProps
  extends SequencerPrimitive.RootProps,
    VariantProps<typeof sequencerVariants> {}

export function Sequencer({
  className,
  size,
  value,
  defaultValue,
  ...props
}: SequencerProps) {
  const columns = (value ?? defaultValue)?.[0]?.length ?? DEFAULT_STEPS;

  return (
    <SequencerPrimitive.Root
      className="w-full"
      defaultValue={defaultValue}
      value={value}
      {...props}
    >
      <SequencerPrimitive.Track
        className={cn(
          "cn-sequencer mx-auto grid w-full touch-none select-none",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          sequencerVariants({ size }),
          className
        )}
        data-slot="sequencer"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        <SequencerPrimitive.Cells>
          {(_state, row, column) => (
            <SequencerPrimitive.Cell
              className="cn-sequencer-cell aspect-square cursor-pointer outline-none"
              column={column}
              key={`sequencer-cell-${row}-${column}`}
              row={row}
            />
          )}
        </SequencerPrimitive.Cells>
      </SequencerPrimitive.Track>
    </SequencerPrimitive.Root>
  );
}
