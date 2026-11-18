import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// A number or a list is a valid value of a native textarea: ui-sdk's holds text.
const text = (value: string | number | readonly string[] | undefined) =>
  Array.isArray(value) ? value.join(",") : value?.toString();

function Textarea({
  className,
  defaultValue,
  value,
  ...props
}: Omit<ComponentProps<typeof TextareaPrimitive>, "defaultValue" | "value"> & {
  defaultValue?: string | number | readonly string[];
  value?: string | number | readonly string[];
}) {
  return (
    <TextareaPrimitive
      className={cn(
        "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm flex field-sizing-content min-h-16 w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      defaultValue={text(defaultValue)}
      value={text(value)}
      {...props}
    />
  );
}

export { Textarea };
