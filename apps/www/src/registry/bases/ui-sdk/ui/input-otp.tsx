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
        "cn-input-otp flex items-center data-disabled:cursor-not-allowed data-disabled:opacity-50",
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
      className={cn("cn-input-otp-group flex items-center", className)}
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
        "cn-input-otp-slot relative flex items-center justify-center data-[active]:z-10",
        className
      )}
      {...props}
    >
      {(slot) => (
        <>
          {slot.char}
          {slot.hasFakeCaret ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="cn-input-otp-caret-line" />
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
      className={cn("cn-input-otp-separator flex items-center", className)}
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
