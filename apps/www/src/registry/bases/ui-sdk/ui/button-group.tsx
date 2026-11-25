import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Separator } from "@/registry/bases/ui-sdk/ui/separator";

const buttonGroupVariants = cva(
  "cn-button-group flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    defaultVariants: {
      orientation: "horizontal",
    },
    variants: {
      orientation: {
        horizontal:
          "cn-button-group-orientation-horizontal *:data-slot:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
        vertical:
          "cn-button-group-orientation-vertical flex-col *:data-slot:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
      },
    },
  }
);

function ButtonGroup({
  className,
  orientation,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      className={cn(buttonGroupVariants({ orientation }), className)}
      data-orientation={orientation}
      data-slot="button-group"
      role="group"
      {...props}
    />
  );
}

function ButtonGroupText({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-button-group-text flex items-center [&_svg]:pointer-events-none",
        className
      )}
      data-slot="button-group-text"
      {...props}
    />
  );
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "cn-button-group-separator relative self-stretch data-[orientation=horizontal]:mx-px data-[orientation=horizontal]:w-auto data-[orientation=vertical]:my-px data-[orientation=vertical]:h-auto",
        className
      )}
      data-part="button-group-separator"
      orientation={orientation}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
