"use client";

import {
  FunnelIcon,
  LayoutGridIcon,
  MenuIcon,
  PanelLeftClose,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useComponents } from "./components-provider";

export function ComponentSidebarHeader() {
  const { toggleSidebar } = useSidebar();
  const {
    sidebarCategoryFilter,
    setSidebarCategoryFilter,
    setSidebarMenuView,
    sidebarMenuView,
  } = useComponents();

  const toggleView = React.useCallback(() => {
    const newView = sidebarMenuView === "menu" ? "inline" : "menu";
    setSidebarMenuView(newView);
  }, [sidebarMenuView, setSidebarMenuView]);

  return (
    <SidebarHeader className="flex h-[51px] flex-row items-center justify-between border-site-border/80 border-b px-6 py-0">
      <div className="flex w-full items-center gap-2">
        <FunnelIcon className="size-3.5 shrink-0 opacity-60" />
        <input
          className="w-full font-medium text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(e) => setSidebarCategoryFilter(e.target.value)}
          placeholder="Filter categories..."
          value={sidebarCategoryFilter}
        />
        {sidebarCategoryFilter && (
          <Button
            className="size-3.5 shrink-0 opacity-60 hover:bg-transparent hover:opacity-100"
            onClick={() => setSidebarCategoryFilter("")}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon className="size-3.25" />
          </Button>
        )}
        <div className="flex shrink-0 items-center gap-2.5">
          <Button
            className="size-3.5 shrink-0 opacity-60 hover:bg-transparent hover:opacity-100"
            onClick={toggleView}
            size="icon-sm"
            title={sidebarMenuView === "menu" ? "Compact view" : "List view"}
            variant="ghost"
          >
            {sidebarMenuView === "menu" ? <LayoutGridIcon /> : <MenuIcon />}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-3.5 shrink-0 opacity-60 hover:bg-transparent hover:opacity-100"
                onClick={toggleSidebar}
                size="icon-sm"
                variant="ghost"
              >
                <PanelLeftClose />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2" side="right">
              Hide sidebar <Kbd>P</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </SidebarHeader>
  );
}
