import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/registry/bases/base/lib/utils";

const markerVariants = cva(
  "cn-marker group/marker relative flex w-full items-center",
  {
    variants: {
      variant: {
        border: "cn-marker-variant-border",
        default: "cn-marker-variant-default",
        separator: "cn-marker-variant-separator",
      },
    },
  }
);

function Marker({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ className, variant })),
      },
      props
    ),
    render,
    state: {
      slot: "marker",
      variant,
    },
  });
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("cn-marker-icon shrink-0", className)}
      data-slot="marker-icon"
      {...props}
    />
  );
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("cn-marker-content min-w-0 wrap-break-word", className)}
      data-slot="marker-content"
      {...props}
    />
  );
}

export { Marker, MarkerContent, MarkerIcon, markerVariants };
