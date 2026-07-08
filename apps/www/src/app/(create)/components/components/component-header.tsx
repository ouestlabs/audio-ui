"use client";

import { SidebarIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
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
    <div className="sticky top-(--header-height) z-20 flex items-center gap-2 border-site-border/80 border-b bg-site-background p-2">
      {!open && (
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
            Show sidebar <Kbd>P</Kbd>
          </TooltipContent>
        </Tooltip>
      )}

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
    </div>
  );
}
