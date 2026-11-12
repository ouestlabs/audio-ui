import { Pad as PadPrimitive } from "@audio-ui/react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

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
        "rounded-[min(var(--radius-md),10px)] border bg-muted/60 text-muted-foreground outline-none transition-[background-color,border-color,color,transform] duration-100 ease-out hover:not-data-active:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-active:scale-[0.97] data-active:border-primary data-active:bg-[color-mix(in_oklab,var(--primary)_calc(55%_+_var(--pad-velocity,1)*45%),var(--muted))] data-active:text-primary-foreground data-active:duration-0 motion-reduce:transition-none motion-reduce:data-active:scale-100 flex aspect-square min-w-0 cursor-pointer items-end justify-start p-2 text-left font-medium text-xs data-disabled:pointer-events-none",
        className
      )}
      data-slot="pad-item"
      {...props}
    />
  );
}

export { Pad, PadItem };
