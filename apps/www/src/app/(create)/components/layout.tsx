import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { ComponentsProvider } from "@/app/(create)/components/components/components-provider";
import { DesignSystemProvider } from "@/app/(create)/customizer/design-system-provider";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { CREATE_PREVIEW_FONTS_ATTR } from "@/app/(create)/lib/fonts";
import { FramedLayoutSkeleton } from "@/components/framed-skeleton";
import { GridSkeleton } from "@/components/grid-skeleton";
import { SiteFooter } from "@/components/site-footer";
import {
  SiteBarContent,
  SiteHeader,
  SiteSidebarHeader,
} from "@/components/site-header";
import {
  getCategories,
  getTotalComponentCount,
  searchCatalog,
} from "@/lib/registry";
import { cn } from "@/lib/utils";

const createPreviewSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const createPreviewMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400"],
});

const createPreviewFontAttrs = {
  [CREATE_PREVIEW_FONTS_ATTR]: "",
};

function ComponentsLayoutFallback() {
  return (
    <FramedLayoutSkeleton
      footer={<SiteFooter docs />}
      header={<SiteSidebarHeader />}
    >
      <GridSkeleton count={4} />
    </FramedLayoutSkeleton>
  );
}

export default function ComponentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const totalCount = getTotalComponentCount();
  const catalogItems = searchCatalog("");
  const categories = getCategories();
  const categoryCounts = categories.reduce(
    (acc, cat) => {
      acc[cat.name] = cat.count;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div
      {...createPreviewFontAttrs}
      className={cn(
        createPreviewSans.variable,
        createPreviewMono.variable,
        "overscroll-behavior- relative flex min-h-svh flex-col lg:[--header-height:0px] bg-site-muted/60 font-site-sans dark:bg-site-background [&_header]:bg-[color-mix(in_oklab,var(--site-muted)_60%,var(--site-background))] dark:[&_header]:bg-site-background"
      )}
    >
      <SiteHeader framed />
      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<ComponentsLayoutFallback />}>
          <LocksProvider>
            <DesignSystemProvider fallback={<ComponentsLayoutFallback />}>
              <ComponentsProvider
                catalogItems={catalogItems}
                categoryCounts={categoryCounts}
                closedEnd={<SiteBarContent part="end" />}
                closedStart={<SiteBarContent part="start" />}
                header={<SiteSidebarHeader />}
                siteEnd={<SiteBarContent part="github" />}
                totalCount={totalCount}
              >
                {children}
              </ComponentsProvider>
            </DesignSystemProvider>
          </LocksProvider>
        </Suspense>
      </main>
    </div>
  );
}
