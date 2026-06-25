import NextLink from "next/link";
import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

function Link({ className, ...props }: React.ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      className={cn("font-medium underline underline-offset-4", className)}
      {...props}
    />
  );
}

export { Link };
