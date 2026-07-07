import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridSkeleton } from "@/components/grid-skeleton";
import { JsonLd } from "@/components/json-ld";
import { siteConfig } from "@/lib/config";
import { getTotalComponentCount, searchCatalog } from "@/lib/registry";
import { getComponentIndexSeo } from "@/lib/registry-seo-cache";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

import { ComponentCategorySeoContent } from "./components/component-category-seo-content";
import { ComponentPreviewView } from "./components/component-preview-view";

// Fully static — ?search= filtering happens client-side
export const dynamic = "force-static";
export const revalidate = false;

const totalComponentCount = getTotalComponentCount();
const allCatalogItems = searchCatalog("");
const title = "Audio UI Components";
const description = `Browse ${totalComponentCount}+ free audio/ui components for React and Tailwind CSS`;
const featuredCategories = [
  {
    href: "/components/player",
    label: "Player",
  },
  {
    href: "/components/channel-strip",
    label: "Channel Strip",
  },
  {
    href: "/components/knob",
    label: "Knob",
  },
  {
    href: "/components/fader",
    label: "Fader",
  },
  {
    href: "/components/xypad",
    label: "XY Pad",
  },
  {
    href: "/components/transport",
    label: "Transport",
  },
  {
    href: "/components/queue",
    label: "Queue",
  },
  {
    href: "/components/synth",
    label: "Synth",
  },
  {
    href: "/components/sortable-list",
    label: "Sortable List",
  },
] as const;

export const metadata: Metadata = buildPageMetadata({
  description,
  keywords: [
    "audio ui components",
    "react audio components",
    "shadcn audio components",
    "shadcn components",
    "shadcn ui components",
    "shadcn ui component",
    "open source shadcn component",
    "React components",
    "Tailwind components",
  ],
  path: "/components",
  title: `${title} - audio/ui`,
});

export default function ComponentsPage() {
  const indexSeo = getComponentIndexSeo();

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: siteConfig.name, path: "/" },
          { name: "Components", path: "/components" },
        ])}
      />
      <section>
        <div className="w-full px-6 pt-8 pb-6 sm:px-8 xl:px-10">
          <h1 className="mt-3 min-w-0 max-w-4xl font-bold text-balanc text-xl sm:text-3xl">
            Audio UI Components
          </h1>
          <p className="mt-4 text-pretty text-base text-site-muted-foreground leading-7">
            Browse {totalComponentCount}+ free open-source audio/ui components
            for React and Tailwind CSS. audio/ui helps you move from headless
            primitives to polished audio product UI — players, mixers, synths,
            and channel strips.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {featuredCategories.map((category) => (
              <Link
                className="site-rounded-full border border-site-border bg-site-background px-3 py-1.5 text-sm transition-colors hover:bg-site-muted"
                href={category.href}
                key={category.href}
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Suspense
        fallback={
          <GridSkeleton
            className="px-6 py-6 sm:px-8 xl:px-10"
            count={allCatalogItems.length}
            showHeader={false}
          />
        }
      >
        <ComponentPreviewView catalogItems={allCatalogItems} />
      </Suspense>
      <ComponentCategorySeoContent seo={indexSeo} />
    </>
  );
}
