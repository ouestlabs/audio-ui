import {
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ScrollAreaPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <ScrollAreaPrimitive className={cn("relative", className)} {...props}>
      <ScrollAreaViewport className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1">
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollBar />
      <ScrollAreaCorner />
    </ScrollAreaPrimitive>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: Omit<ComponentProps<typeof ScrollAreaScrollbar>, "children">) {
  return (
    <ScrollAreaScrollbar
      className={cn(
        "cn-scroll-area-scrollbar flex touch-none p-px transition-colors select-none",
        className
      )}
      orientation={orientation}
      {...props}
    >
      <ScrollAreaThumb className="cn-scroll-area-thumb relative flex-1 bg-border" />
    </ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
