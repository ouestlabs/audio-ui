import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A text field with none of the field's own look, for a name edited in place
 * on a track, a clip or a marker: it keeps the field's role and place in the
 * page's snapshot, and draws what its `className` says.
 */
export function BareInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-auto rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      data-slot="bare-input"
      {...props}
    />
  );
}