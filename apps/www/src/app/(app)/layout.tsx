import { Geist, Geist_Mono } from "next/font/google";
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

/**
 * One layout for the home, the docs and the components: the header, the
 * sidebars and the frame are rendered here once, and what changes from a
 * section to the next is the page in the panel and the links in the sidebar.
 * A page streams into the panel; the rest is there already.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categoryCounts = Object.fromEntries(
    getCategories().map((category) => [category.name, category.count])
  );

  return (
    <div
      {...createPreviewFontAttrs}
      className={cn(
        createPreviewSans.variable,
        createPreviewMono.variable,
        "overscroll-behavior relative flex min-h-svh flex-col bg-site-muted/60 font-site-sans lg:[--header-height:0px] dark:bg-site-background [&_header]:bg-[color-mix(in_oklab,var(--site-muted)_60%,var(--site-background))] dark:[&_header]:bg-site-background"
      )}
    >
      <SiteHeader framed />
      <main className="flex min-h-0 flex-1 flex-col">
        <SiteShell
          catalog={{
            catalogItems: searchCatalog(""),
            categoryCounts,
            totalCount: getTotalComponentCount(),
          }}
          closedEnd={<SiteBarContent part="end" />}
          closedStart={<SiteBarContent part="start" />}
          footer={<SiteFooter docs />}
          header={<SiteSidebarHeader />}
          siteEnd={<SiteBarContent part="github" />}
          tree={source.getPageTree()}
        >
          {children}
        </SiteShell>
      </main>
    </div>
  );
}
