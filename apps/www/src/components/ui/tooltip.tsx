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
        "data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-98 data-closed:fade-out-0 data-closed:zoom-out-98 z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-background text-xs ease-out has-data-[slot=kbd]:pr-1.5 data-closed:animate-out data-open:animate-in **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    >
      {children}
      <TooltipArrow className="data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5 z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-start]:top-1/2! data-[side=left]:top-1/2! data-[side=right]:top-1/2!" />
    </TooltipContentPrimitive>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
