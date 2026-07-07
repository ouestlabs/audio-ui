"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "cn-checkbox peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="cn-checkbox-indicator grid place-content-center text-current transition-none"
        data-slot="checkbox-indicator"
      >
        <IconPlaceholder
          hugeicons="Tick02Icon"
          lucide="CheckIcon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          tabler="IconCheck"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
