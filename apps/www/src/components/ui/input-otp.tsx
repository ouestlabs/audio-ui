import {
  OTPInputGroup,
  OTPInput as OTPInputPrimitive,
  OTPInputSeparator,
  OTPInputSlot,
} from "@ui-sdk/react/otp-input";
import type { ComponentProps } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";

function InputOTP({
  className,
  containerClassName,
  ...props
}: Omit<ComponentProps<typeof OTPInputPrimitive>, "className"> & {
  // The shadcn API styles the slots' container apart from the input: ui-sdk's input is invisible, so both style the root.
  className?: string;
  containerClassName?: string;
}) {
  return (
    <OTPInputPrimitive
      className={cn(
        "gap-2 flex items-center data-disabled:cursor-not-allowed data-disabled:opacity-50",
        containerClassName,
        className
      )}
      {...props}
    />
  );
}

function InputOTPGroup({
  className,
  ...props
}: ComponentProps<typeof OTPInputGroup>) {
  return (
    <OTPInputGroup
      className={cn(
        "has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive rounded-lg has-aria-invalid:ring-3 flex items-center",
        className
      )}
      {...props}
    />
  );
}

function InputOTPSlot({
  className,
  ...props
}: Omit<ComponentProps<typeof OTPInputSlot>, "children">) {
  return (
    <OTPInputSlot
      className={cn(
        "dark:bg-input/30 border-input data-[active]:border-ring data-[active]:ring-ring/50 data-[active]:aria-invalid:ring-destructive/20 dark:data-[active]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active]:aria-invalid:border-destructive size-8 border-y border-r text-sm transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg data-[active]:ring-3 relative flex items-center justify-center data-[active]:z-10",
        className
      )}
      {...props}
    >
      {(slot) => (
        <>
          {slot.char}
          {slot.hasFakeCaret ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
            </div>
          ) : null}
        </>
      )}
    </OTPInputSlot>
  );
}

function InputOTPSeparator({
  className,
  ...props
}: ComponentProps<typeof OTPInputSeparator>) {
  return (
    <OTPInputSeparator
      className={cn(
        "[&_svg:not([class*='size-'])]:size-4 flex items-center",
        className
      )}
      {...props}
    >
      <IconPlaceholder
        hugeicons="MinusSignIcon"
        lucide="MinusIcon"
        phosphor="MinusIcon"
        remixicon="RiSubtractLine"
        tabler="IconMinus"
      />
    </OTPInputSeparator>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
