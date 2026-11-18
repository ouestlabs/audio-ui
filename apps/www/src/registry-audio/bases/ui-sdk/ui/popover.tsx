import {
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription as PopoverDescriptionPrimitive,
  Popover as PopoverPrimitive,
  PopoverTitle as PopoverTitlePrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
} from "@ui-sdk/react/popover";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry-audio/bases/ui-sdk/hooks/use-popup-container";

function Popover({
  container,
  ...props
}: ComponentProps<typeof PopoverPrimitive>) {
  const popups = usePopupContainer();
  return <PopoverPrimitive container={container ?? popups} {...props} />;
}

function PopoverTrigger({
  nativeButton: _nativeButton,
  ...props
}: ComponentProps<typeof PopoverTriggerPrimitive> & {
  // The shadcn flag for a trigger that renders a link: ui-sdk needs none.
  nativeButton?: boolean;
}) {
  return <PopoverTriggerPrimitive {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverContentPrimitive>) {
  return (
    <PopoverContentPrimitive
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "cn-popover-content cn-popover-content-logical z-50 w-72 origin-(--transform-origin) outline-hidden",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-popover-header", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({
  className,
  ...props
}: ComponentProps<typeof PopoverTitlePrimitive>) {
  return (
    <PopoverTitlePrimitive
      className={cn("cn-popover-title", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: ComponentProps<typeof PopoverDescriptionPrimitive>) {
  return (
    <PopoverDescriptionPrimitive
      className={cn("cn-popover-description", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
