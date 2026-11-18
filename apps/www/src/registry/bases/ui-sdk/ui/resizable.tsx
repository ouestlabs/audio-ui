import {
  ResizableHandle as ResizableHandlePrimitive,
  ResizablePanel,
  Resizable as ResizablePrimitive,
} from "@ui-sdk/react/resizable";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive>) {
  return (
    <ResizablePrimitive
      className={cn(
        "flex size-full data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  );
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof ResizableHandlePrimitive> & {
  withHandle?: boolean;
}) {
  return (
    <ResizableHandlePrimitive
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="cn-resizable-handle-icon z-10 flex shrink-0" />
      ) : null}
    </ResizableHandlePrimitive>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
