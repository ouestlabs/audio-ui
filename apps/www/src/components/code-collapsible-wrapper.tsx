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
      className={cn("group/collapsible md:-mx-1 relative", className)}
      onOpenChange={setIsOpened}
      open={isOpened}
      {...props}
    >
      <CollapsibleTrigger
        nativeButton={false}
        render={
          <div
            className={cn(
              "absolute top-2 z-10 flex items-center",
              isOpened ? "right-9" : "right-2"
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
          "mt-6 h-full p-px data-closed:max-h-64 [&>figure]:mt-0 [&>figure]:md:mx-0!",
          "data-closed:[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)]",
          "data-closed:mask-[linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)]"
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
              "site-rounded-b-lg -bottom-2 absolute inset-x-0 flex h-20 items-center justify-center bg-linear-to-b from-site-code/70 to-site-code",
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
