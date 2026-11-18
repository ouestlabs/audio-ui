import {
  HoverCardContent as HoverCardContentPrimitive,
  HoverCard as HoverCardPrimitive,
  HoverCardTrigger,
} from "@ui-sdk/react/hover-card";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

function HoverCard({
  container,
  ...props
}: ComponentProps<typeof HoverCardPrimitive>) {
  const popups = usePopupContainer();
  return <HoverCardPrimitive container={container ?? popups} {...props} />;
}

function HoverCardContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  ...props
}: ComponentProps<typeof HoverCardContentPrimitive>) {
  return (
    <HoverCardContentPrimitive
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "cn-hover-card-content cn-hover-card-content-logical z-50 origin-(--transform-origin) outline-hidden",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
