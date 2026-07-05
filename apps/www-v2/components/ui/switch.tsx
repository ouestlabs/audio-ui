"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer site-rounded-full inline-flex h-[1.15rem] w-8 shrink-0 items-center border border-transparent shadow-xs outline-none transition-all focus-visible:border-site-ring focus-visible:ring-[3px] focus-visible:ring-site-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-site-primary data-[state=unchecked]:bg-site-input dark:data-[state=unchecked]:bg-site-input/80",
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "site-rounded-full pointer-events-none block size-4 bg-site-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-site-primary-foreground dark:data-[state=unchecked]:bg-site-foreground"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
