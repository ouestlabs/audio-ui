import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "site-rounded-md field-sizing-content flex min-h-16 w-full border border-site-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-site-muted-foreground focus-visible:border-site-ring focus-visible:ring-[3px] focus-visible:ring-site-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-site-destructive aria-invalid:ring-site-destructive/20 md:text-sm dark:bg-site-input/30 dark:aria-invalid:ring-site-destructive/40",
        className
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
