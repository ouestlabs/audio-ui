import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "site-rounded-md inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap border px-2 py-0.5 font-medium text-xs transition-[color,box-shadow] focus-visible:border-site-ring focus-visible:ring-[3px] focus-visible:ring-site-ring/50 aria-invalid:border-site-destructive aria-invalid:ring-site-destructive/20 dark:aria-invalid:ring-site-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-site-primary text-site-primary-foreground [a&]:hover:bg-site-primary/90",
        secondary:
          "border-transparent bg-site-secondary text-site-secondary-foreground [a&]:hover:bg-site-secondary/90",
        destructive:
          "border-transparent bg-site-destructive text-site-destructive-foreground focus-visible:ring-site-destructive/20 dark:bg-site-destructive/60 dark:focus-visible:ring-site-destructive/40 [a&]:hover:bg-site-destructive/90",
        outline:
          "text-site-foreground [a&]:hover:bg-site-accent [a&]:hover:text-site-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      className={cn(badgeVariants({ variant }), className)}
      data-slot="badge"
      {...props}
    />
  );
}

export { Badge, badgeVariants };
