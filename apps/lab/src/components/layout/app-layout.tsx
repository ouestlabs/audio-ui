import { InfoIcon, SidebarIcon } from "@phosphor-icons/react/ssr";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppSidebar } from "./app-sidebar.tsx";
import { DevicePanel } from "./device-panel.tsx";

/** At the start of the bar: shows and hides the navigation sidebar, a sheet on a narrow screen. */
function NavigationToggle() {
  const { open, toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="text-muted-foreground"
            onClick={toggleSidebar}
            size="icon"
            variant="outline"
          >
            <SidebarIcon aria-hidden />
          </Button>
        }
      />
      <TooltipContent side="bottom">
        {open ? "Hide" : "Show"} navigation
      </TooltipContent>
    </Tooltip>
  );
}

/** At the end of the bar: shows and hides the device's details. */
function DetailsToggle({
  onClick,
  open,
}: {
  onClick: () => void;
  open: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-expanded={open}
            aria-label="Toggle details"
            className="text-muted-foreground"
            onClick={onClick}
            size="icon"
            variant="outline"
          >
            <InfoIcon aria-hidden />
          </Button>
        }
      />
      <TooltipContent side="bottom">
        {open ? "Hide" : "Show"} details
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The layout of the docs: the navigation sidebar on the left, and the page in
 * an inset frame (a bar, the page scrolling under it) that stays in the
 * viewport.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const toggleDetails = useCallback(() => setDetailsOpen((open) => !open), []);
  return (
    <SidebarProvider className="h-svh min-h-0 items-stretch gap-0 [--sidebar-width:15rem]">
      <AppSidebar />
      <main className="min-h-0 min-w-0 flex-1 p-2">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-muted/50 p-0.5">
          <header className="flex min-h-11 shrink-0 items-center gap-2 px-2 py-1.5">
            <NavigationToggle />
            <Separator orientation="vertical" />
            <div className="ml-auto">
              <DetailsToggle onClick={toggleDetails} open={detailsOpen} />
            </div>
          </header>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border bg-background">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </main>
      <DevicePanel onOpenChange={setDetailsOpen} open={detailsOpen} />
    </SidebarProvider>
  );
}
