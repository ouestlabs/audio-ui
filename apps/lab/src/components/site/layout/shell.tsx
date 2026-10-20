import { useEffect, useState } from "react";
import { SourceDialog } from "@/components/code/source-dialog";
import { DetailsPanel } from "@/components/site/details/panel";
import {
  Frame,
  FrameContent,
  FrameHeader,
} from "@/components/site/layout/frame";
import { FrameBar } from "@/components/site/layout/frame-bar";
import { CommandMenu } from "@/components/site/navigation/command-menu";
import { LabSidebar } from "@/components/site/navigation/sidebar";
import { LabProvider, useLab } from "@/components/site/providers/lab-provider";
import { SidebarProvider } from "@/components/ui/sidebar";

function Layout({ children }: { children: React.ReactNode }) {
  const { actions, state } = useLab();
  const { detailsOpen, detailsSheetOpen, navigationOpen } = state;
  const { setDetailsOpen, setNavigationOpen } = actions;

  // From here the state tells which sidebars are shut: the note the page started with is done.
  useEffect(() => {
    document.documentElement.removeAttribute("data-nav-closed");
    document.documentElement.removeAttribute("data-details-open");
  }, []);

  // Once the stored choice is applied, wait two frames before letting the sidebars animate: they would otherwise slide on load.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
  }, []);

  return (
    <SidebarProvider
      // As in the docs: the width changes at once, so the page is laid out once, and what is shown eases in. The details aside does the same from the right.
      className="h-svh min-h-0 items-stretch gap-0 [--sidebar-width:15rem] **:data-[slot=sidebar-container]:transition-none **:data-[slot=sidebar-gap]:transition-none [&_[data-state=expanded]_[data-slot=sidebar-inner]]:fade-in-0 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:slide-in-from-left-4 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:animate-in [&_[data-state=expanded]_[data-slot=sidebar-inner]]:duration-200 [&_[data-state=expanded]_[data-slot=sidebar-inner]]:ease-[cubic-bezier(0.22,1,0.36,1)] [&_[data-state=expanded]_[data-slot=sidebar-inner]]:motion-reduce:animate-none"
      data-lab-layout=""
      onOpenChange={setNavigationOpen}
      open={navigationOpen}
    >
      {settled ? null : (
        <style>
          {
            "[data-lab-layout] * { transition-duration: 0s !important; animation-duration: 0s !important; }"
          }
        </style>
      )}
      <LabSidebar />
      <main className="min-h-0 min-w-0 flex-1 p-2">
        <Frame className="h-full">
          <FrameHeader>
            <FrameBar />
          </FrameHeader>
          <FrameContent className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {children}
            </div>
          </FrameContent>
        </Frame>
      </main>
      <DetailsPanel
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
        sheetOpen={detailsSheetOpen}
      />
      <CommandMenu />
      <SourceDialog />
    </SidebarProvider>
  );
}

/**
 * The layout of the docs: the navigation sidebar on the left, the page in an
 * inset frame (a bar, the page scrolling under it) that stays in the
 * viewport, the details on the right, and the command menu over it all.
 */
export function LabShell({ children }: { children: React.ReactNode }) {
  return (
    <LabProvider>
      <Layout>{children}</Layout>
    </LabProvider>
  );
}
