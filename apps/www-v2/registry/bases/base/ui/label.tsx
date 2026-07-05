"use client";

import type * as React from "react";

import { cn } from "@/registry/bases/base/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "cn-label flex select-none items-center peer-disabled:cursor-not-allowed group-data-[disabled=true]:pointer-events-none",
        className
      )}
      data-slot="label"
      {...props}
    />
  );
}

export { Label };
