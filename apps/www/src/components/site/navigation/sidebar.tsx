import { DocsNavigation } from "@/components/docs/page/sidebar";
import { IconSidebarContent } from "@/components/icons/icon-sidebar";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import type { source } from "@/lib/docs/content/source";

export type SiteSection = "docs" | "icons";

/**
 * The one navigation sidebar of the site. Its header (the logo, the section
 * tabs, the search) stays put while the links under it follow the section: the
 * docs' pages or the icons'.
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
        {section === "icons" ? <IconSidebarContent /> : null}
        {section === "docs" ? <DocsNavigation tree={tree} /> : null}
      </SidebarContent>
    </Sidebar>
  );
}
