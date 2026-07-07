"use client";

import { SidebarIcon } from "@phosphor-icons/react/ssr";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useCustomizer } from "./components-context";

export function CustomizerSidebarHeader() {
  const { toggleCustomizer } = useCustomizer();

  return (
    <div className="flex h-[51px] shrink-0 items-center justify-between overflow-hidden border-site-border/80 border-b pr-2 pl-3">
      <div className="min-w-0 flex-1 whitespace-nowrap">
        <h2 className="inline-flex items-center gap-1 font-medium text-site-foreground">
          <Avatar className="size-4">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <span className="leading-none">/</span>
          <span className="text-sm leading-none">create</span>
        </h2>
        <p className="text-site-muted-foreground text-xs leading-none">
          Adjust shadcn styles
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="shrink-0"
              onClick={toggleCustomizer}
              size="icon"
              variant="ghost"
            >
              <SidebarIcon weight="duotone" />
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
