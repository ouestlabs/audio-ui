import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/registry/bases/radix/lib/utils";

const buttonVariants = cva(
  "cn-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "cn-button-size-default",
        icon: "cn-button-size-icon",
        "icon-lg": "cn-button-size-icon-lg",
        "icon-sm": "cn-button-size-icon-sm",
        "icon-xs": "cn-button-size-icon-xs",
        lg: "cn-button-size-lg",
        sm: "cn-button-size-sm",
        xs: "cn-button-size-xs",
      },
      variant: {
        default: "cn-button-variant-default",
        destructive: "cn-button-variant-destructive",
        ghost: "cn-button-variant-ghost",
        link: "cn-button-variant-link",
        outline: "cn-button-variant-outline",
        secondary: "cn-button-variant-secondary",
      },
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
}

export { Button, buttonVariants };
