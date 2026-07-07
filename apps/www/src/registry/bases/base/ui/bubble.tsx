import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/registry/bases/base/lib/utils";

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-bubble-group flex min-w-0 flex-col", className)}
      data-slot="bubble-group"
      {...props}
    />
  );
}

const bubbleVariants = cva(
  "cn-bubble group/bubble relative flex w-fit min-w-0 flex-col",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "cn-bubble-variant-default",
        destructive: "cn-bubble-variant-destructive",
        ghost: "cn-bubble-variant-ghost",
        muted: "cn-bubble-variant-muted",
        outline: "cn-bubble-variant-outline",
        secondary: "cn-bubble-variant-secondary",
        tinted: "cn-bubble-variant-tinted",
      },
    },
  }
);

function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    align?: "start" | "end";
  }) {
  return (
    <div
      className={cn(bubbleVariants({ variant }), className)}
      data-align={align}
      data-slot="bubble"
      data-variant={variant}
      {...props}
    />
  );
}

function BubbleContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "cn-bubble-content w-fit max-w-full min-w-0 overflow-hidden wrap-break-word [button]:text-left [button,a]:transition-colors",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "bubble-content",
    },
  });
}

const bubbleReactionsVariants = cva(
  "cn-bubble-reactions absolute z-10 flex w-fit items-center justify-center",
  {
    defaultVariants: {
      align: "end",
      side: "bottom",
    },
    variants: {
      align: {
        end: "cn-bubble-reactions-align-end",
        start: "cn-bubble-reactions-align-start",
      },
      side: {
        bottom: "cn-bubble-reactions-side-bottom",
        top: "cn-bubble-reactions-side-top",
      },
    },
  }
);

function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <div
      className={cn(bubbleReactionsVariants({ align, side }), className)}
      data-align={align}
      data-side={side}
      data-slot="bubble-reactions"
      {...props}
    />
  );
}

export { Bubble, BubbleContent, BubbleGroup, BubbleReactions };
