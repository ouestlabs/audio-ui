import { Suspense } from "react";
import { DesignSystemProvider } from "@/app/(create)/customizer/design-system-provider";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { DocsSidebar } from "@/components/docs-sidebar";
import { FramedLayout } from "@/components/framed-layout";
import { FramedLayoutSkeleton } from "@/components/framed-skeleton";
import { SiteFooter } from "@/components/site-footer";
import {
  SiteBarContent,
  SiteHeader,
  SiteSidebarHeader,
} from "@/components/site-header";
import { source } from "@/lib/source";

function RootFallback() {
  return (
    <FramedLayoutSkeleton
      footer={<SiteFooter docs />}
      header={<SiteSidebarHeader />}
    />
  );
}

export default function RootAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lg:[--header-height:0px]">
      <SiteHeader framed />
      <Suspense fallback={<RootFallback />}>
        <LocksProvider>
          <DesignSystemProvider fallback={<RootFallback />}>
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
              {children}
            </FramedLayout>
          </DesignSystemProvider>
        </LocksProvider>
      </Suspense>
    </div>
  );
}
