import {
  Radio,
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator,
} from "@ui-sdk/react/radio";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      className={cn("cn-radio-group w-full", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: Omit<ComponentProps<typeof Radio>, "children">) {
  return (
    <Radio
      className={cn(
        "cn-radio-group-item group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioIndicator className="cn-radio-group-indicator">
        <span className="cn-radio-group-indicator-icon" />
      </RadioIndicator>
    </Radio>
  );
}

export { RadioGroup, RadioGroupItem };
