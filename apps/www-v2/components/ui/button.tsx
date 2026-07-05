import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "site-rounded-md inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium font-site-sans text-sm outline-none transition-all focus-visible:border-site-ring focus-visible:ring-[3px] focus-visible:ring-site-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-site-destructive aria-invalid:ring-site-destructive/20 dark:aria-invalid:ring-site-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-site-primary text-site-primary-foreground hover:bg-site-primary/90",
        destructive:
          "bg-site-destructive text-site-destructive-foreground hover:bg-site-destructive/90 focus-visible:ring-site-destructive/20 dark:bg-site-destructive/60 dark:focus-visible:ring-site-destructive/40",
        outline:
          "border border-site-border bg-site-background shadow-xs hover:bg-site-accent hover:text-site-accent-foreground dark:border-site-input dark:bg-site-input/30 dark:hover:bg-site-input/50",
        secondary:
          "bg-site-secondary text-site-secondary-foreground hover:bg-site-secondary/80",
        ghost:
          "hover:bg-site-accent hover:text-site-accent-foreground dark:hover:bg-site-accent/50",
        link: "text-site-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "site-rounded-md h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "site-rounded-md h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "site-rounded-md h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs":
          "site-rounded-md size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
      className={cn(buttonVariants({ variant, size, className }))}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
}

export { Button, buttonVariants };
