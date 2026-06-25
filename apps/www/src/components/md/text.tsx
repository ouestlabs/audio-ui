import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

function Paragraph({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "not-first:mt-6 text-muted-foreground leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

function Strong({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <strong
      className={cn("font-medium text-foreground", className)}
      {...props}
    />
  );
}

function Blockquote({
  className,
  ...props
}: React.ComponentProps<"blockquote">) {
  return (
    <blockquote
      className={cn("mt-6 border-l-2 ps-6 italic", className)}
      {...props}
    />
  );
}

export { Paragraph, Strong, Blockquote };
