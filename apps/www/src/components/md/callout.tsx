import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

interface CalloutProps extends React.ComponentProps<"div"> {
  variant?: "default" | "info" | "warning" | "error" | "success";
}

function Callout({
  variant = "default",
  className,
  children,
  ...props
}: CalloutProps) {
  return (
    <div
      className={cn(
        "my-6 grid grid-cols-[4px_1fr] items-start gap-3 rounded-lg border bg-card p-3 text-muted-foreground text-sm",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full w-1 rounded-full bg-muted-foreground",
          variant === "info" && "bg-blue-500!",
          variant === "warning" && "bg-amber-500",
          variant === "error" && "bg-destructive",
          variant === "success" && "bg-green-500"
        )}
        role="presentation"
      />
      <div className="text-pretty">{children}</div>
    </div>
  );
}

export { Callout };
