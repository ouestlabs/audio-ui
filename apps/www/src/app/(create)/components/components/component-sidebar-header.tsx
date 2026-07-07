"use client";

import {
  FunnelIcon,
  ListIcon,
  SidebarIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/ssr";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Kbd } from "@/components/ui/kbd";
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComponents } from "./components-context";

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
    <SidebarHeader className="flex h-[51px] flex-row items-center justify-between border-site-border/80 border-b pl-3">
      <div className="flex w-full items-center gap-2">
        <FunnelIcon className="shrink-0 opacity-60" weight="duotone" />
        <input
          aria-label="Filter categories"
          className="w-full font-medium text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(e) => setSidebarCategoryFilter(e.target.value)}
          placeholder="Filter categories..."
          type="search"
          value={sidebarCategoryFilter}
        />

        <ButtonGroup className="flex shrink-0">
          <Button
            onClick={toggleView}
            size="icon"
            title={sidebarMenuView === "menu" ? "Compact view" : "List view"}
            variant="outline"
          >
            {sidebarMenuView === "menu" ? (
              <SquaresFourIcon weight="duotone" />
            ) : (
              <ListIcon weight="duotone" />
            )}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button onClick={toggleSidebar} size="icon" variant="outline">
                  <SidebarIcon weight="duotone" />
                </Button>
              }
            />
            <TooltipContent className="flex items-center gap-2" side="right">
              Hide sidebar <Kbd>P</Kbd>
            </TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </div>
    </SidebarHeader>
  );
}
