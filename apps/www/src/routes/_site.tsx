import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { LookStyle } from "@/components/customizer/look/look-style";
import { SiteFooter } from "@/components/site/layout/footer";
import { SiteShell } from "@/components/site/layout/shell";
import {
  SiteBarContent,
  SiteHeader,
  SiteSidebarHeader,
} from "@/components/site/navigation/header";
import { CREATE_PREVIEW_FONTS_ATTR } from "@/lib/design-system/fonts";
import { source } from "@/lib/docs/content/source";

/** The docs' page tree, read once on the server: the sidebars list its pages. */
const loadPageTree = createServerFn({ method: "GET" }).handler(async () => ({
  pageTree: await source.serializePageTree(source.getPageTree()),
}));

const previewFontAttrs = { [CREATE_PREVIEW_FONTS_ATTR]: "" };

export const Route = createFileRoute("/_site")({
  component: SiteLayout,
  // The tree does not change while the site runs: read it once, not on every navigation.
  gcTime: Number.POSITIVE_INFINITY,
  loader: () => loadPageTree(),
  staleTime: Number.POSITIVE_INFINITY,
});

/**
 * One layout for the home, the docs and the icons: the header, the
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
      <LookStyle />
      <SiteHeader framed tree={pageTree} />
      <main className="flex min-h-0 flex-1 flex-col">
        <SiteShell
          closedEnd={<SiteBarContent part="end" tree={pageTree} />}
          closedStart={<SiteBarContent part="start" tree={pageTree} />}
          footer={<SiteFooter docs />}
          header={<SiteSidebarHeader tree={pageTree} />}
          siteEnd={<SiteBarContent part="github" />}
          tree={pageTree}
        >
          <Outlet />
        </SiteShell>
      </main>
    </div>
  );
}
