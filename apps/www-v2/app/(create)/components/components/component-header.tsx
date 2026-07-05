"use client";

import { PanelLeftOpen } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { hasActiveCatalogSearch } from "@/lib/catalog-search-filter";

import { ComponentHeaderGridToggle } from "./component-header-grid-toggle";
import { ComponentHeaderMobileDrawer } from "./component-header-mobile-drawer";
import { ComponentHeaderSearch } from "./component-header-search";
import { CustomizerSidebarToggle } from "./customizer-sidebar-toggle";

export function ComponentHeader() {
  const { open, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasSearch = hasActiveCatalogSearch(searchParams.get("search") || "");
  const currentCategory =
    pathname.startsWith("/components/") && pathname !== "/components"
      ? (pathname.split("/").at(-1) ?? "")
      : "";
  const showGridToggle = Boolean(currentCategory) || hasSearch;

  return (
    <div className="sticky top-(--header-height) z-10 flex h-[51px] items-center gap-2 border-site-border/80 border-b bg-site-background px-6 sm:px-8 xl:px-10">
      <ComponentHeaderMobileDrawer />

      {!open && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="-ml-2 hidden text-site-muted-foreground hover:bg-transparent hover:text-site-foreground md:flex"
              onClick={toggleSidebar}
              size="icon-sm"
              variant="ghost"
            >
              <PanelLeftOpen />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2" side="right">
            Show sidebar <Kbd>P</Kbd>
          </TooltipContent>
        </Tooltip>
      )}

      <ComponentHeaderSearch />

      <div className="ml-auto flex items-center gap-2">
        {showGridToggle && <ComponentHeaderGridToggle />}
        <CustomizerSidebarToggle />
      </div>
    </div>
  );
}
