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
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            "absolute top-2 z-10 flex items-center",
            isOpened ? "right-9" : "right-2"
          )}
        >
          <Button
            className="site-rounded-md h-7 px-2 text-site-muted-foreground"
            size="sm"
            variant="ghost"
          >
            {isOpened ? "Collapse" : "Expand"}
          </Button>
          {isOpened && (
            <Separator className="mx-1.5 h-4!" orientation="vertical" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        className="relative mt-6 overflow-hidden data-[state=closed]:max-h-64 [&>figure]:mt-0 [&>figure]:md:mx-0!"
        forceMount
      >
        {children}
      </CollapsibleContent>
      <CollapsibleTrigger className="site-rounded-b-lg -bottom-2 absolute inset-x-0 flex h-20 items-center justify-center bg-linear-to-b from-site-code/70 to-site-code text-site-muted-foreground text-sm group-data-[state=open]/collapsible:hidden">
        {isOpened ? "Collapse" : "Expand"}
      </CollapsibleTrigger>
    </Collapsible>
  );
}
