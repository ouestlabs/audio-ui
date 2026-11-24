import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A button with none of the button's own look, for the dense parts of a
 * workstation whose control is a name, a readout or a strip: it keeps the
 * button's role, keyboard and place in the page's snapshot, and draws what
 * its `className` says.
 */
export function BareButton({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <Button
      className={cn(
        "inline-block h-auto gap-0 rounded-none border-0 bg-transparent px-0 font-normal text-[length:inherit] hover:bg-transparent hover:text-inherit active:translate-y-0 aria-expanded:bg-transparent aria-expanded:text-inherit dark:hover:bg-transparent",
        className
      )}
      data-slot="bare-button"
      type="button"
      variant="ghost"
      {...props}
    />
  );
}