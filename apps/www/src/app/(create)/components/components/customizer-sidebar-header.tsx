"use client";

import { SlidersHorizontalIcon, XIcon } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import { useCustomizer } from "./components-context";

export function CustomizerSidebarHeader({ className }: { className?: string }) {
  const { toggleCustomizer } = useCustomizer();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between overflow-hidden border-site-border/80 border-b p-2",
        className
      )}
    >
      <h2 className="inline-flex items-center gap-1.5 px-2 font-medium text-site-foreground">
        <SlidersHorizontalIcon className="size-4 shrink-0" weight="duotone" />
        <span className="text-sm leading-none">Customize</span>
      </h2>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="shrink-0"
              onClick={toggleCustomizer}
              size="icon"
              variant="ghost"
            >
              <XIcon weight="bold" />
            </Button>
          }
        />
        <TooltipContent className="flex items-center gap-2 pr-1">
          Close sidebar <Kbd>C</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
