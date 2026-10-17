import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { CREATE_PREVIEW_FONTS_ATTR } from "@/app/(create)/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import {
  SiteBarContent,
  SiteHeader,
  SiteSidebarHeader,
} from "@/components/site-header";
import { SiteShell } from "@/components/site-shell";
import {
  getCategories,
  getTotalComponentCount,
  searchCatalog,
} from "@/lib/registry";
import { source } from "@/lib/source";

/** The docs' page tree, read once on the server: the sidebars list its pages. */
const loadPageTree = createServerFn({ method: "GET" }).handler(async () => ({
  pageTree: await source.serializePageTree(source.getPageTree()),
}));

const categoryCounts = Object.fromEntries(
  getCategories().map((category) => [category.name, category.count])
);
const catalog = {
  catalogItems: searchCatalog(""),
  categoryCounts,
  totalCount: getTotalComponentCount(),
};
const previewFontAttrs = { [CREATE_PREVIEW_FONTS_ATTR]: "" };

export const Route = createFileRoute("/_site")({
  component: SiteLayout,
  // The tree does not change while the site runs: read it once, not on every navigation.
  gcTime: Number.POSITIVE_INFINITY,
  loader: () => loadPageTree(),
  staleTime: Number.POSITIVE_INFINITY,
});

/**
 * One layout for the home, the docs and the components: the header, the
 * sidebars and the frame are rendered here once, and what changes from a
 * section to the next is the page in the panel and the links in the sidebar.
 */
function SiteLayout() {
  const { pageTree } = useFumadocsLoader(Route.useLoaderData());

  return (
    <div
      {...previewFontAttrs}
      className="overscroll-behavior relative flex min-h-svh flex-col bg-site-muted/60 font-site-sans lg:[--header-height:0px] dark:bg-site-background [&_header]:bg-[color-mix(in_oklab,var(--site-muted)_60%,var(--site-background))] dark:[&_header]:bg-site-background"
    >
      <SiteHeader framed />
      <main className="flex min-h-0 flex-1 flex-col">
        <SiteShell
          catalog={catalog}
          closedEnd={<SiteBarContent part="end" />}
          closedStart={<SiteBarContent part="start" />}
          footer={<SiteFooter docs />}
          header={<SiteSidebarHeader />}
          siteEnd={<SiteBarContent part="github" />}
          tree={pageTree}
        >
          <Outlet />
        </SiteShell>
      </main>
    </div>
  );
}
