"use client";

import { Suspense } from "react";
import { ComponentSidebarContent } from "@/components/catalog/sidebar/component-sidebar-content";
import { DocsNavigation } from "@/components/docs/page/sidebar";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { source } from "@/lib/docs/content/source";

export type SiteSection = "components" | "docs";

const ROWS = [64, 80, 48, 72, 56, 88, 60, 76] as const;

/** Links to come: shown where the categories are awaited, while the rest of the sidebar is there. */
function LinksSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-4 pt-3">
      {ROWS.map((width) => (
        <Skeleton className="h-4" key={width} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

/**
 * The one navigation sidebar of the site. Its header (the logo, the section
 * tabs, the search) stays put while the links under it follow the section: the
 * docs' pages, or the components' categories.
 */
export function SiteSidebar({
  header,
  section,
  tree,
}: {
  header?: React.ReactNode;
  section: SiteSection;
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const { isMobile } = useSidebar();

  if (isMobile) {
    return null;
  }

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))] bg-transparent group-data-[side=left]:border-r-0 **:data-[slot=sidebar-inner]:bg-transparent">
      {header}
      <SidebarContent className="gap-0 overflow-hidden p-0">
        {section === "components" ? (
          <Suspense fallback={<LinksSkeleton />}>
            <ComponentSidebarContent />
          </Suspense>
        ) : (
          <DocsNavigation tree={tree} />
        )}
      </SidebarContent>
    </Sidebar>
  );
}
