import { Switch as SwitchPrimitive, SwitchThumb } from "@ui-sdk/react/switch";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: Omit<ComponentProps<typeof SwitchPrimitive>, "children"> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive
      className={cn(
        "cn-switch peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      data-size={size}
      {...props}
    >
      <SwitchThumb className="cn-switch-thumb pointer-events-none block ring-0 transition-transform" />
    </SwitchPrimitive>
  );
}

export { Switch };
