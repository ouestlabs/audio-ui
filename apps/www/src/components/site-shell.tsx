"use client";

import { usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";
import { ComponentHeaderGridToggle } from "@/app/(create)/components/components/component-header-grid-toggle";
import { ComponentHeaderMobileDrawer } from "@/app/(create)/components/components/component-header-mobile-drawer";
import { ComponentHeaderSearch } from "@/app/(create)/components/components/component-header-search";
import {
  ComponentsContext,
  type ComponentsContextValue,
} from "@/app/(create)/components/components/components-context";
import { DesignSystemEffects } from "@/app/(create)/customizer/design-system-provider";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { DocsDesignSystemEffects } from "@/components/docs-design-system-sync";
import { FramedLayout } from "@/components/framed-layout";
import { SiteSidebar } from "@/components/site-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { source } from "@/lib/source";

/** What the bar's search is while it waits for the URL: the field's place, kept. */
function SearchSkeleton() {
  return <Skeleton className="h-8 min-w-0 flex-1" />;
}

/**
 * The part of the site that does not change from a page to the next: the
 * sidebars and the frame. The section (docs or components) only decides which
 * links the sidebar lists and which tools the bar offers.
 */
export function SiteShell({
  catalog,
  children,
  closedEnd,
  closedStart,
  footer,
  header,
  siteEnd,
  tree,
}: {
  catalog: ComponentsContextValue;
  children: React.ReactNode;
  closedEnd: React.ReactNode;
  closedStart: React.ReactNode;
  footer: React.ReactNode;
  header: React.ReactNode;
  siteEnd: React.ReactNode;
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const pathname = usePathname();
  const inCatalog = pathname === "/components" || pathname.startsWith("/components/");
  const value = useMemo(() => catalog, [catalog]);

  return (
    <ComponentsContext.Provider value={value}>
      <LocksProvider>
        {inCatalog ? (
          // Reads the URL: its own boundary, so the page is not taken with it.
          <Suspense fallback={null}>
            <DesignSystemEffects />
          </Suspense>
        ) : (
          <DocsDesignSystemEffects />
        )}
        <FramedLayout
          actions={inCatalog ? <ComponentHeaderGridToggle /> : undefined}
          closedEnd={closedEnd}
          closedStart={closedStart}
          footer={footer}
          nav={
            <SiteSidebar
              header={header}
              section={inCatalog ? "components" : "docs"}
              tree={tree}
            />
          }
          siteEnd={siteEnd}
          start={
            inCatalog ? (
              <>
                <ComponentHeaderMobileDrawer />
                <Suspense fallback={<SearchSkeleton />}>
                  <ComponentHeaderSearch />
                </Suspense>
              </>
            ) : undefined
          }
        >
          {children}
        </FramedLayout>
      </LocksProvider>
    </ComponentsContext.Provider>
  );
}
