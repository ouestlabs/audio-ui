import { useLocation } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import {
  ComponentsContext,
  type ComponentsContextValue,
} from "@/components/catalog/components-context";
import { ComponentHeaderSearch } from "@/components/catalog/sidebar/component-header-search";
import { DesignSystemEffects } from "@/components/customizer/design-system-provider";
import { DocsDesignSystemEffects } from "@/components/docs/page/design-system-sync";
import { IconSearch } from "@/components/icons/icon-search";
import { FramedLayout } from "@/components/site/layout/framed-layout";
import {
  type SiteSection,
  SiteSidebar,
} from "@/components/site/navigation/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { LocksProvider } from "@/hooks/use-locks";
import { useReadingSection } from "@/hooks/use-sidebar-groups";
import type { source } from "@/lib/docs/content/source";

/** What the bar's search is while it waits for the URL: the field's place, kept. */
function SearchSkeleton() {
  return <Skeleton className="h-8 min-w-0 flex-1" />;
}

/** What the bar holds at its start: the search of the catalog, or of the icons, on their pages. */
function BarStart({ pathname }: { pathname: string }) {
  if (pathname === "/icons") {
    return <IconSearch />;
  }
  if (pathname === "/components" || pathname.startsWith("/components/")) {
    return (
      <Suspense fallback={<SearchSkeleton />}>
        <ComponentHeaderSearch />
      </Suspense>
    );
  }
  return null;
}

/**
 * The part of the site that does not change from a page to the next: the
 * sidebars and the frame. The section (docs, components or icons) only decides
 * which links the sidebar lists and which tools the bar offers.
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
  const reading = useReadingSection(tree);
  let section: SiteSection = "docs";
  if (inCatalog) {
    section = "components";
  } else if (reading === "icons") {
    section = "icons";
  }
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
          nav={<SiteSidebar header={header} section={section} tree={tree} />}
          siteEnd={siteEnd}
          start={<BarStart pathname={pathname} />}
        >
          {children}
        </FramedLayout>
      </LocksProvider>
    </ComponentsContext.Provider>
  );
}
