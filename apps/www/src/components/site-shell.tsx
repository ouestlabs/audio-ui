"use client";

import { useLocation } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { ComponentHeaderSearch } from "@/components/catalog/component-header-search";
import {
  ComponentsContext,
  type ComponentsContextValue,
} from "@/components/catalog/components-context";
import { DesignSystemEffects } from "@/components/customizer/design-system-provider";
import { DocsDesignSystemEffects } from "@/components/docs-design-system-sync";
import { FramedLayout } from "@/components/framed-layout";
import { SiteSidebar } from "@/components/site-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { LocksProvider } from "@/hooks/use-locks";
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
  const pathname = useLocation({ select: (location) => location.pathname });
  const inCatalog =
    pathname === "/components" || pathname.startsWith("/components/");
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
              <Suspense fallback={<SearchSkeleton />}>
                <ComponentHeaderSearch />
              </Suspense>
            ) : undefined
          }
        >
          {children}
        </FramedLayout>
      </LocksProvider>
    </ComponentsContext.Provider>
  );
}
