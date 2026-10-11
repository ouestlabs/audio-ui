import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { DocsDesignSystemSync } from "@/components/docs-design-system-sync";
import { DocsSidebar } from "@/components/docs-sidebar";
import { FramedLayout } from "@/components/framed-layout";
import { SiteFooter } from "@/components/site-footer";
import {
  SiteBarContent,
  SiteHeader,
  SiteSidebarHeader,
} from "@/components/site-header";
import { source } from "@/lib/source";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lg:[--header-height:0px]">
      <SiteHeader framed />
      <DocsDesignSystemSync>
        <LocksProvider>
          <FramedLayout
            closedEnd={<SiteBarContent part="end" />}
            closedStart={<SiteBarContent part="start" />}
            footer={<SiteFooter docs />}
            nav={
              <DocsSidebar
                header={<SiteSidebarHeader />}
                tree={source.getPageTree()}
              />
            }
            siteEnd={<SiteBarContent part="github" />}
          >
            <div className="flex-1 px-4 sm:px-8">{children}</div>
          </FramedLayout>
        </LocksProvider>
      </DocsDesignSystemSync>
    </div>
  );
}
