"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function CodeCollapsibleWrapper({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Collapsible>) {
  const [isOpened, setIsOpened] = React.useState(false);

  return (
    <Collapsible
      className={cn("group/collapsible relative", className)}
      onOpenChange={setIsOpened}
      open={isOpened}
      {...props}
    >
      <CollapsibleTrigger
        nativeButton={false}
        render={
          <div
            className={cn(
              "absolute top-[7px] z-10 flex items-center",
              isOpened
                ? "right-[calc(2.75rem+2px)]"
                : "right-[calc(0.5rem+2px)]"
            )}
          >
            <Button
              className="text-site-muted-foreground"
              size="sm"
              variant="outline"
            >
              {isOpened ? "Collapse" : "Expand"}
            </Button>
            {isOpened && (
              <Separator className="mx-1.5" orientation="vertical" />
            )}
          </div>
        }
      />
      <CollapsibleContent
        className={cn(
          // Closed, the code is cut in its panel; the frame around it stays whole.
          "mt-6 h-full data-closed:[&_pre]:max-h-64 data-closed:[&_pre]:overflow-hidden [&>figure]:mt-0 [&>figure]:md:mx-0!"
        )}
        hidden={false}
        keepMounted
      >
        {children}
      </CollapsibleContent>
      <CollapsibleTrigger
        nativeButton={false}
        render={
          <div
            className={cn(
              // Inside the panel, concentric with it: the frame's ring and border (3px) inward, the panel's own radius.
              "absolute inset-x-[3px] bottom-[3px] flex h-20 items-end justify-center rounded-b-[13px] bg-linear-to-b from-transparent to-site-code pb-1",
              "group-data-open/collapsible:hidden"
            )}
          >
            <Button
              className="cursor-pointer bg-transparent! text-site-muted-foreground text-sm"
              variant="ghost"
            >
              {isOpened ? "Collapse" : "Expand"}
            </Button>
          </div>
        }
      />
    </Collapsible>
  );
}
