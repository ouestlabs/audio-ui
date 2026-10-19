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
  const { detailsOpen, focus } = state;
  const { setDetailsOpen } = actions;
  return (
    <SidebarProvider className="h-svh min-h-0 items-stretch gap-0 [--sidebar-width:15rem]">
      {focus ? null : <LabSidebar />}
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
      {focus ? null : (
        <DetailsPanel onOpenChange={setDetailsOpen} open={detailsOpen} />
      )}
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
