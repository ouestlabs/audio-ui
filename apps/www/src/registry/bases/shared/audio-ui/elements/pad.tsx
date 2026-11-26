import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/registry/lib/utils";
import { Pad as PadPrimitive } from "@/registry/primitives/pad/react";

/**
 * How each part of the pads is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the props: the React pads apply these classes,
 * and `registry:build` writes them as plain CSS on the parts for every other
 * framework. The root reads its columns from `--pad-columns`.
 */
export const padParts = Object.freeze({
  pad: "grid w-full select-none grid-cols-[repeat(var(--pad-columns),minmax(0,1fr))] gap-2 data-disabled:opacity-50",
  "pad-item":
    "cn-pad-item flex aspect-square min-w-0 cursor-pointer items-end justify-start p-2 text-left font-medium text-xs data-disabled:pointer-events-none",
});

type PadProps = Omit<
  ComponentProps<typeof PadPrimitive.Root>,
  "className" | "style"
> & {
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
      className={cn(padParts.pad, className)}
      columns={columns}
      data-slot="pad"
      style={{ "--pad-columns": columns, ...style } as CSSProperties}
      {...props}
    />
  );
}

type PadItemProps = Omit<
  ComponentProps<typeof PadPrimitive.Item>,
  "className"
> & {
  className?: string;
};

/** One pad: give it a `value`, and a label as its content or `aria-label`. */
function PadItem({ className, ...props }: PadItemProps) {
  return (
    <PadPrimitive.Item
      className={cn(padParts["pad-item"], className)}
      data-slot="pad-item"
      {...props}
    />
  );
}

export { Pad, PadItem };
