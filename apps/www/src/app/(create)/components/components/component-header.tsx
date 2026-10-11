"use client";

import { SidebarIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import { FrameHeader } from "@/components/custom/frame";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ComponentHeaderGridToggle } from "./component-header-grid-toggle";
import { ComponentHeaderMobileDrawer } from "./component-header-mobile-drawer";
import { ComponentHeaderSearch } from "./component-header-search";
import { useCustomizer } from "./components-context";
import { CustomizerSidebarToggle } from "./customizer-sidebar-toggle";

export function ComponentHeader() {
  const { open, toggleSidebar } = useSidebar();
  const { toggleCustomizer } = useCustomizer();

  return (
    <FrameHeader className="min-h-11 shrink-0 flex-row items-center gap-2 px-2 py-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="hidden text-site-muted-foreground md:flex"
              onClick={toggleSidebar}
              size="icon"
              variant="outline"
            >
              <SidebarIcon />
            </Button>
          }
        />
        <TooltipContent className="flex items-center gap-2" side="right">
          {open ? "Hide" : "Show"} sidebar <Kbd>P</Kbd>
        </TooltipContent>
      </Tooltip>

      <ComponentHeaderMobileDrawer />

      <ComponentHeaderSearch />

      <div className="ml-auto flex items-center gap-2">
        <ComponentHeaderGridToggle />
        <CustomizerSidebarToggle />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="lg:hidden"
                onClick={toggleCustomizer}
                size="icon"
                variant="outline"
              >
                <SlidersHorizontalIcon weight="bold" />
                <span className="sr-only">Customize</span>
              </Button>
            }
          />
          <TooltipContent className="flex items-center gap-2" side="right">
            Open customizer
            <Kbd>C</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </FrameHeader>
  );
}
