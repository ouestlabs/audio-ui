import {
  mergeProps,
  type RenderProp,
  renderElement,
} from "@ui-sdk/react/primitive";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "cn-badge group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "cn-badge-variant-default",
        destructive: "cn-badge-variant-destructive",
        ghost: "cn-badge-variant-ghost",
        link: "cn-badge-variant-link",
        outline: "cn-badge-variant-outline",
        secondary: "cn-badge-variant-secondary",
      },
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: ComponentProps<"span"> & { render?: RenderProp } & VariantProps<
    typeof badgeVariants
  >) {
  return renderElement(
    "span",
    mergeProps(
      {
        className: cn(badgeVariants({ variant }), className),
        "data-slot": "badge",
        "data-variant": variant,
      },
      props
    ),
    render
  );
}

export { Badge, badgeVariants };
