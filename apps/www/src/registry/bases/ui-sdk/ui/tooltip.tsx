import {
  TooltipArrow,
  TooltipContent as TooltipContentPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

function Tooltip({
  container,
  ...props
}: ComponentProps<typeof TooltipPrimitive>) {
  const popups = usePopupContainer();
  return <TooltipPrimitive container={container ?? popups} {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  children,
  ...props
}: Omit<ComponentProps<typeof TooltipContentPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <TooltipContentPrimitive
      className={cn(
        "cn-tooltip-content cn-tooltip-content-logical z-50 w-fit max-w-xs origin-(--transform-origin) bg-foreground text-background",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    >
      {children}
      <TooltipArrow className="cn-tooltip-arrow cn-tooltip-arrow-logical z-50 bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
    </TooltipContentPrimitive>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
