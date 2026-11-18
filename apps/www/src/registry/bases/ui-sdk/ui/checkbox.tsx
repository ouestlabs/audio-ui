import {
  CheckboxIndicator,
  Checkbox as CheckboxPrimitive,
} from "@ui-sdk/react/checkbox";
import type { ComponentProps } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<typeof CheckboxPrimitive>, "children">) {
  return (
    <CheckboxPrimitive
      className={cn(
        "cn-checkbox peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxIndicator className="cn-checkbox-indicator grid place-content-center text-current transition-none">
        <IconPlaceholder
          hugeicons="Tick02Icon"
          lucide="CheckIcon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          tabler="IconCheck"
        />
      </CheckboxIndicator>
    </CheckboxPrimitive>
  );
}

export { Checkbox };
