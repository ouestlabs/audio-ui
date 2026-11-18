import { Separator as SeparatorPrimitive } from "@ui-sdk/react/separator";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Separator({
  className,
  ...props
}: ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
