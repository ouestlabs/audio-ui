import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

function Step({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("mt-8 scroll-m-32 font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function Steps({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className="steps [&>h3]:step mb-12 [counter-reset:step] *:[h3]:first:mt-0!"
      {...props}
    />
  );
}

export { Step, Steps };
