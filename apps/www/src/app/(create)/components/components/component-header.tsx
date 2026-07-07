"use client";

import { SidebarIcon } from "@phosphor-icons/react/ssr";
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
    <div className="sticky top-(--header-height) z-20 flex h-[51px] items-center gap-2 border-site-border/80 border-b bg-site-background px-2">
      <ComponentHeaderMobileDrawer />

      {!open && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="hidden text-site-muted-foreground md:flex"
                onClick={toggleSidebar}
                size="icon"
                variant="ghost"
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

      <ComponentHeaderSearch />

      <div className="ml-auto flex items-center gap-2">
        {showGridToggle && <ComponentHeaderGridToggle />}
        <CustomizerSidebarToggle />
      </div>
    </div>
  );
}
