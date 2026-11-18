import { Button as ButtonPrimitive } from "@ui-sdk/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "cn-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
  nativeButton: _nativeButton,
  onClick,
  ...props
}: Omit<ComponentProps<typeof ButtonPrimitive>, "children" | "onClick"> & {
  children?: ReactNode;
  /** Base UI's flag for a button that renders a link: ui-sdk needs none. */
  nativeButton?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
} & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ className, size, variant }))}
      data-slot="button"
      onClick={onClick as ComponentProps<typeof ButtonPrimitive>["onClick"]}
      {...props}
    />
  );
}

export { Button, buttonVariants };
