import { Input as InputPrimitive } from "@ui-sdk/react/input";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// A number or a list is a valid value of a native input: ui-sdk's holds text.
const text = (value: string | number | readonly string[] | undefined) =>
  Array.isArray(value) ? value.join(",") : value?.toString();

function Input({
  className,
  defaultValue,
  value,
  ...props
}: Omit<ComponentProps<typeof InputPrimitive>, "defaultValue" | "value"> & {
  defaultValue?: string | number | readonly string[];
  value?: string | number | readonly string[];
}) {
  return (
    <InputPrimitive
      className={cn(
        "cn-input w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      data-slot="input"
      defaultValue={text(defaultValue)}
      value={text(value)}
      {...props}
    />
  );
}

export { Input };
