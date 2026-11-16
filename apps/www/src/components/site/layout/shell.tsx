import { useLocation } from "@tanstack/react-router";
import { DocsDesignSystemEffects } from "@/components/docs/page/design-system-sync";
import { IconSearch } from "@/components/icons/icon-search";
import { FramedLayout } from "@/components/site/layout/framed-layout";
import {
  type SiteSection,
  SiteSidebar,
} from "@/components/site/navigation/sidebar";
import { LocksProvider } from "@/hooks/use-locks";
import { useReadingSection } from "@/hooks/use-sidebar-groups";
import type { source } from "@/lib/docs/content/source";

/** What the bar holds at its start: the search of the icons, on their page. */
function BarStart({ pathname }: { pathname: string }) {
  return pathname === "/icons" ? <IconSearch /> : null;
}

/**
 * The part of the site that does not change from a page to the next: the
 * sidebars and the frame. The section (docs or icons) only decides
 * which links the sidebar lists and which tools the bar offers.
 */
export function SiteShell({
  children,
  closedEnd,
  closedStart,
  footer,
  header,
  siteEnd,
  tree,
}: {
  children: React.ReactNode;
  closedEnd: React.ReactNode;
  closedStart: React.ReactNode;
  footer: React.ReactNode;
  header: React.ReactNode;
  siteEnd: React.ReactNode;
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const reading = useReadingSection(tree);
  const section: SiteSection = reading === "icons" ? "icons" : "docs";

  return (
    <LocksProvider>
      <DocsDesignSystemEffects />
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
  );
}
