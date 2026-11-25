import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Separator } from "@/registry/bases/ui-sdk/ui/separator";

function ItemGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-item-group group/item-group flex w-full flex-col",
        className
      )}
      data-slot="item-group"
      role="list"
      {...props}
    />
  );
}

function ItemSeparator({
  className,
  ...props
}: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn("cn-item-separator", className)}
      data-part="item-separator"
      orientation="horizontal"
      {...props}
    />
  );
}

const itemVariants = cva(
  "cn-item group/item flex w-full flex-wrap items-center transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "cn-item-size-default",
        sm: "cn-item-size-sm",
        xs: "cn-item-size-xs",
      },
      variant: {
        default: "cn-item-variant-default",
        muted: "cn-item-variant-muted",
        outline: "cn-item-variant-outline",
      },
    },
  }
);

function Item({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return (
    <div
      className={cn(itemVariants({ className, size, variant }))}
      data-size={size}
      data-slot="item"
      data-variant={variant}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  "cn-item-media flex shrink-0 items-center justify-center [&_svg]:pointer-events-none",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "cn-item-media-variant-default",
        icon: "cn-item-media-variant-icon",
        image: "cn-item-media-variant-image",
      },
    },
  }
);

function ItemMedia({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      className={cn(itemMediaVariants({ className, variant }))}
      data-slot="item-media"
      data-variant={variant}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-item-content flex flex-1 flex-col [&+[data-slot=item-content]]:flex-none",
        className
      )}
      data-slot="item-content"
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-item-title line-clamp-1 flex w-fit items-center",
        className
      )}
      data-slot="item-title"
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "cn-item-description line-clamp-2 font-normal [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      data-slot="item-description"
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-item-actions flex items-center", className)}
      data-slot="item-actions"
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-item-header flex basis-full items-center justify-between",
        className
      )}
      data-slot="item-header"
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-item-footer flex basis-full items-center justify-between",
        className
      )}
      data-slot="item-footer"
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
