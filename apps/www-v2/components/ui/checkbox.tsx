"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer site-rounded-sm size-4 shrink-0 border border-site-input shadow-xs outline-none transition-shadow focus-visible:border-site-ring focus-visible:ring-[3px] focus-visible:ring-site-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-site-destructive aria-invalid:ring-site-destructive/20 data-[state=checked]:border-site-primary data-[state=checked]:bg-site-primary data-[state=checked]:text-site-primary-foreground dark:bg-site-input/30 dark:data-[state=checked]:bg-site-primary dark:aria-invalid:ring-site-destructive/40",
        className
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="grid place-content-center text-current transition-none"
        data-slot="checkbox-indicator"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
