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
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      defaultValue={text(defaultValue)}
      value={text(value)}
      {...props}
    />
  );
}

export { Input };
