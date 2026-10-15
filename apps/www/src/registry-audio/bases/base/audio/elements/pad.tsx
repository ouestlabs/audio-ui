"use client";

import { Pad as PadPrimitive } from "@audio-ui/react";
import type { CSSProperties } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

type PadProps = Omit<PadPrimitive.Root.Props, "className" | "style"> & {
  className?: string;
  style?: CSSProperties;
};

/**
 * A grid of pads to strike, `columns` to a row. Each pad sounds while held,
 * by pointer or with Enter or Space, and flashes as hard as it was struck. The
 * arrow keys move between pads.
 */
function Pad({ className, columns = 4, style, ...props }: PadProps) {
  return (
    <PadPrimitive.Root
      className={cn(
        "grid w-full select-none grid-cols-[repeat(var(--pad-columns),minmax(0,1fr))] gap-2 data-disabled:opacity-50",
        className
      )}
      columns={columns}
      data-slot="pad"
      style={{ "--pad-columns": columns, ...style } as CSSProperties}
      {...props}
    />
  );
}

type PadItemProps = Omit<PadPrimitive.Item.Props, "className"> & {
  className?: string;
};

/** One pad: give it a `value`, and a label as its content or `aria-label`. */
function PadItem({ className, ...props }: PadItemProps) {
  return (
    <PadPrimitive.Item
      className={cn(
        "cn-pad-item flex aspect-square min-w-0 cursor-pointer items-end justify-start p-2 text-left font-medium text-xs data-disabled:pointer-events-none",
        className
      )}
      data-slot="pad-item"
      {...props}
    />
  );
}

export { Pad, PadItem };
