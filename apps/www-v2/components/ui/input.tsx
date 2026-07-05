import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "site-rounded-md h-9 w-full min-w-0 border border-site-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-site-primary selection:text-site-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-site-foreground file:text-sm placeholder:text-site-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-site-input/30",
        "focus-visible:border-site-ring focus-visible:ring-[3px] focus-visible:ring-site-ring/50",
        "aria-invalid:border-site-destructive aria-invalid:ring-site-destructive/20 dark:aria-invalid:ring-site-destructive/40",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
